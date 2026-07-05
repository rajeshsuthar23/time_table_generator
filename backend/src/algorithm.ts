import { Batch, BatchSubjectTeacher, Subject, Teacher, TeacherHolidayOverride, TimetableEntry, TimetableWeek } from '@prisma/client';
import prisma from './db';
import { format } from 'date-fns';

export function isNthSaturday(date: Date, n: number): boolean {
  if (date.getDay() !== 6) return false;
  const dayOfMonth = date.getDate();
  const weekNumber = Math.ceil(dayOfMonth / 7);
  return weekNumber === n;
}

export async function generateWeek(weekStartDateStr: string, adHocHolidays: { teacherId: number, date: string }[]) {
  const [y, m, d] = weekStartDateStr.split('-');
  const inputDate = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0);
  
  // Align to Monday
  const dayOfWeek = inputDate.getDay();
  const diffToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
  const weekStart = new Date(inputDate);
  weekStart.setDate(weekStart.getDate() + diffToMonday);
  
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dates = days.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const batches = await prisma.batch.findMany();
  const subjects = await prisma.subject.findMany();
  const teachers = await prisma.teacher.findMany();
  const mappings = await prisma.batchSubjectTeacher.findMany({
    include: { subject: true, teacher: true, batch: true }
  });

  let positionInFortnight = 1;
  let fortnightId: number | undefined;

  const existingWeek = await prisma.timetableWeek.findFirst({
    where: { weekStartDate: weekStart }
  });

  if (existingWeek) {
    positionInFortnight = existingWeek.positionInFortnight;
    fortnightId = existingWeek.fortnightId ?? undefined;
  } else {
    const lastWeek = await prisma.timetableWeek.findFirst({
      where: { weekStartDate: { lt: weekStart } },
      orderBy: { weekStartDate: 'desc' }
    });

    if (lastWeek && lastWeek.positionInFortnight === 1) {
      positionInFortnight = 2;
      fortnightId = lastWeek.fortnightId ?? undefined;
    } else {
      positionInFortnight = 1;
      
      const fnStartDate = new Date(weekStart);
      fnStartDate.setDate(fnStartDate.getDate() - 1); // Start on Sunday
      
      const fnEndDate = new Date(fnStartDate);
      fnEndDate.setDate(fnEndDate.getDate() + 13); // End on Saturday
      
      const fn = await prisma.timetableFortnight.create({
        data: {
          startDate: fnStartDate,
          endDate: fnEndDate
        }
      });
      fortnightId = fn.id;
    }
  }

    const priorFortnights = await prisma.timetableFortnight.findMany({
      where: {
        ...(fortnightId ? { id: { not: fortnightId } } : {}),
        weeks: { some: {} }
      },
      include: { weeks: { include: { entries: true } } }
    });

  const allFortnights = await prisma.timetableFortnight.findMany({
    where: { startDate: { lte: weekStart } },
    include: { weeks: { include: { entries: true } } }
  });

  const allTimeCounts: Record<number, Record<number, number>> = {};
  let totalFortnightsElapsed = allFortnights.length;

  for (const fn of allFortnights) {
    for (const w of fn.weeks) {
      if (w.weekStartDate.getTime() === weekStart.getTime()) continue;

      for (const entry of w.entries) {
        if (entry.subjectId) {
          if (!allTimeCounts[entry.batchId]) allTimeCounts[entry.batchId] = {};
          allTimeCounts[entry.batchId][entry.subjectId] = (allTimeCounts[entry.batchId][entry.subjectId] || 0) + 1;
        }
      }
    }
  }

  const targetFortnights = positionInFortnight === 2 ? totalFortnightsElapsed : totalFortnightsElapsed;

  const generatedEntries: any[] = [];
  const dailyTeacherUsage: Record<string, Record<string, { count: number, windows: string[] }>> = {};
  
  for (let dateIdx = 0; dateIdx < dates.length; dateIdx++) {
    const currentDate = dates[dateIdx];
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayName = days[dateIdx];
    dailyTeacherUsage[dateStr] = {};

    const unavailableTeachers = new Set<string>();
    
    for (const teacher of teachers) {
      const name = teacher.name.toUpperCase();
      const is2ndSat = isNthSaturday(currentDate, 2);
      const is4thSat = isNthSaturday(currentDate, 4);

      if (name === 'YOGESH' && (is2ndSat || is4thSat)) unavailableTeachers.add(name);
      if (name === 'SADIKA' && (is2ndSat || is4thSat)) unavailableTeachers.add(name);
      if (name === 'VIRENDRA' && dayName === 'Wed') unavailableTeachers.add(name);
      if (name === 'SMITA' && is2ndSat) unavailableTeachers.add(name);
      if (name === 'HARSHALA' && dayName !== 'Fri') unavailableTeachers.add(name);
      if (name === 'DEEPTI' && !['Wed', 'Thu', 'Fri'].includes(dayName)) unavailableTeachers.add(name);
    }
    
    for (const adHoc of adHocHolidays) {
      console.log(`Checking adHoc: ${JSON.stringify(adHoc)} against dateStr: ${dateStr}`);
      if (adHoc.date === dateStr) {
        const t = teachers.find(t => t.id === Number(adHoc.teacherId));
        if (t) {
          console.log(`Adding ${t.name.toUpperCase()} to unavailable for ${dateStr}`);
          unavailableTeachers.add(t.name.toUpperCase());
        }
      }
    }
    console.log(`Unavailable for ${dateStr}:`, Array.from(unavailableTeachers));

    for (const batch of batches) {
      const batchMappings = mappings.filter(m => m.batchId === batch.id);
      
      let eligible = batchMappings.filter(m => {
        const teacherName = m.teacher.name.toUpperCase();
        if (unavailableTeachers.has(teacherName)) return false;
        
        if (teacherName === 'SONAM' && batch.slotStart !== '16:00') return false;
        if (teacherName === 'SMITA' && batch.slotStart !== '16:00') return false;
        
        const usage = dailyTeacherUsage[dateStr][teacherName] || { count: 0, windows: [] };
        if (usage.windows.includes(batch.slotStart)) return false;
        
        if (teacherName === 'SADIKA' && usage.count >= 1) return false;

        const max = 3; 
        
        let currentFortnightCount = generatedEntries.filter(e => e.batchId === batch.id && e.subjectId === m.subjectId).length;
        
        if (positionInFortnight === 2) {
            const w1 = allFortnights.find(f => f.id === fortnightId)?.weeks.find(w => w.positionInFortnight === 1);
            if (w1) {
                currentFortnightCount += w1.entries.filter(e => e.batchId === batch.id && e.subjectId === m.subjectId).length;
            }
        }
          
        if (currentFortnightCount >= max) return false;

        return true;
      });

      eligible.sort((a, b) => {
        const weeklySubjectCounts = generatedEntries.reduce((acc, e) => {
            if(!acc[e.batchId]) acc[e.batchId] = {};
            acc[e.batchId][e.subjectId] = (acc[e.batchId][e.subjectId] || 0) + 1;
            return acc;
        }, {} as any);
        
        const pastCounts = allTimeCounts;

        const aScheduledThisWeek = weeklySubjectCounts[batch.id]?.[a.subjectId] || 0;
        const bScheduledThisWeek = weeklySubjectCounts[batch.id]?.[b.subjectId] || 0;

        const pastCountA = pastCounts[batch.id] && pastCounts[batch.id][a.subjectId] ? pastCounts[batch.id][a.subjectId] : 0;
        const pastCountB = pastCounts[batch.id] && pastCounts[batch.id][b.subjectId] ? pastCounts[batch.id][b.subjectId] : 0;

        const totalScheduledA = aScheduledThisWeek + pastCountA;
        const totalScheduledB = bScheduledThisWeek + pastCountB;

        const freqA = a.subject.type === 'language' ? 1 : 2;
        const freqB = b.subject.type === 'language' ? 1 : 2;

        const currentTargetA = freqA * (1 + priorFortnights.length); 
        const currentTargetB = freqB * (1 + priorFortnights.length);

        const deficitA = currentTargetA - totalScheduledA;
        const deficitB = currentTargetB - totalScheduledB;

        const deficitRatioA = deficitA / freqA;
        const deficitRatioB = deficitB / freqB;

        if (Math.abs(deficitRatioA - deficitRatioB) > 0.01) {
          return deficitRatioB - deficitRatioA; 
        }
        
        if (deficitA !== deficitB) {
          return deficitB - deficitA;
        }

        return Math.random() - 0.5;
      });

      if (eligible.length > 0) {
        const winner = eligible[0];
        generatedEntries.push({
          batchId: batch.id,
          day: dayName,
          date: currentDate,
          subjectId: winner.subjectId,
          teacherId: winner.teacherId,
          unresolved: false
        });

        const tName = winner.teacher.name.toUpperCase();
        if (!dailyTeacherUsage[dateStr][tName]) {
          dailyTeacherUsage[dateStr][tName] = { count: 0, windows: [] };
        }
        dailyTeacherUsage[dateStr][tName].count++;
        dailyTeacherUsage[dateStr][tName].windows.push(batch.slotStart);

      } else {
        generatedEntries.push({
          batchId: batch.id,
          day: dayName,
          date: currentDate,
          subjectId: null,
          teacherId: null,
          unresolved: true
        });
      }
    }
  }

  if (existingWeek) {
    await prisma.timetableEntry.deleteMany({
      where: { weekId: existingWeek.id }
    });
    
    await prisma.timetableWeek.update({
      where: { id: existingWeek.id },
      data: {
        entries: {
          create: generatedEntries
        }
      }
    });
    
    return await prisma.timetableWeek.findUnique({
      where: { id: existingWeek.id },
      include: { entries: { include: { subject: true, teacher: true, batch: true } } }
    });
  } else {
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 5);

    const week = await prisma.timetableWeek.create({
      data: {
        weekStartDate: weekStart,
        weekEndDate: weekEndDate,
        fortnightId: fortnightId!,
        positionInFortnight,
        entries: {
          create: generatedEntries
        }
      }
    });

    return await prisma.timetableWeek.findUnique({
      where: { id: week.id },
      include: { entries: { include: { subject: true, teacher: true, batch: true } } }
    });
  }
}
