import { Router } from 'express';
import prisma from './db';
import { generateWeek } from './algorithm';

const router = Router();

router.get('/master-data', async (req, res) => {
  try {
    const batches = await prisma.batch.findMany();
    const subjects = await prisma.subject.findMany();
    const teachers = await prisma.teacher.findMany();
    const mappings = await prisma.batchSubjectTeacher.findMany({
      include: { subject: true, teacher: true }
    });
    res.json({ batches, subjects, teachers, mappings });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get('/seed', async (req, res) => {
  try {
    const teachers = ['Yogesh', 'Sadika', 'Virendra', 'Sonam', 'Smita', 'Harshala', 'Deepti', 'Pankaj', 'Sujata', 'Gargi', 'Akash', 'Prahlad', 'Rashmi', 'Aftab'];
    for (const name of teachers) {
      await prisma.teacher.upsert({
        where: { name: name.toUpperCase() },
        update: {},
        create: { name: name.toUpperCase() }
      });
    }

    const subjectsData = [
      { name: 'English', type: 'language' }, { name: 'Hindi', type: 'language' }, { name: 'Sanskrit', type: 'core' },
      { name: 'Marathi', type: 'language' }, { name: 'Math', type: 'core' }, { name: 'Math 1', type: 'core' },
      { name: 'Math 2', type: 'core' }, { name: 'Science', type: 'core' }, { name: 'Science 1', type: 'core' },
      { name: 'Science 2', type: 'core' }, { name: 'Physics', type: 'core' }, { name: 'Chemistry', type: 'core' },
      { name: 'Biology', type: 'core' }, { name: 'History', type: 'core' }, { name: 'Geography', type: 'core' }
    ];
    for (const sub of subjectsData) {
      const existing = await prisma.subject.findFirst({ where: { name: sub.name } });
      if (!existing) await prisma.subject.create({ data: { name: sub.name, type: sub.type } });
    }

    const batchesData = [
      { name: 'STATE 7', board: 'STATE', grade: 7, slotStart: '14:00', slotEnd: '16:00' },
      { name: 'STATE 8', board: 'STATE', grade: 8, slotStart: '14:00', slotEnd: '16:00' },
      { name: 'STATE 9', board: 'STATE', grade: 9, slotStart: '14:00', slotEnd: '16:00' },
      { name: 'STATE 10', board: 'STATE', grade: 10, slotStart: '14:00', slotEnd: '16:00' },
      { name: 'CBSE 8', board: 'CBSE', grade: 8, slotStart: '16:00', slotEnd: '18:00' },
      { name: 'CBSE 9', board: 'CBSE', grade: 9, slotStart: '16:00', slotEnd: '18:00' },
      { name: 'CBSE 10', board: 'CBSE', grade: 10, slotStart: '16:00', slotEnd: '18:00' },
      { name: 'ICSE 8', board: 'ICSE', grade: 8, slotStart: '16:00', slotEnd: '18:00' },
      { name: 'ICSE 9', board: 'ICSE', grade: 9, slotStart: '16:00', slotEnd: '18:00' },
      { name: 'ICSE 10', board: 'ICSE', grade: 10, slotStart: '16:00', slotEnd: '18:00' },
    ];
    for (const b of batchesData) {
      await prisma.batch.upsert({ where: { name: b.name }, update: {}, create: b });
    }

    const matrix = [
      ['English', 'SADIKA', 'SADIKA', 'SADIKA', 'HARSHALA', 'SADIKA', 'SADIKA', 'HARSHALA', 'SADIKA', 'SADIKA', 'HARSHALA'],
      ['Hindi', 'SUJATA', 'SUJATA', 'SUJATA', 'GARGI', 'SUJATA', 'SUJATA', 'GARGI', 'SUJATA', null, null],
      ['Sanskrit', null, 'GARGI', 'GARGI', 'GARGI', 'GARGI', 'GARGI', 'GARGI', 'GARGI', null, null],
      ['Marathi', 'SUJATA', 'SUJATA', 'DEEPTI', 'VIRENDRA', 'SUJATA', 'DEEPTI', 'VIRENDRA', 'SUJATA', 'DEEPTI', 'VIRENDRA'],
      ['Math', 'PANKAJ', 'PANKAJ', null, null, 'PANKAJ', null, null, 'PANKAJ', null, null],
      ['Math 1', null, null, 'PANKAJ', 'PRAHLAD', null, 'PRAHLAD', 'PRAHLAD', null, 'PANKAJ', 'PRAHLAD'],
      ['Math 2', null, null, 'AKASH', 'AKASH', null, 'AKASH', 'AKASH', null, 'AKASH', 'AKASH'],
      ['Science', 'AFTAB', 'PANKAJ', 'RASHMI', null, 'PANKAJ', 'RASHMI', null, null, null, null],
      ['Science 1', null, null, null, 'PANKAJ', null, null, null, null, null, null],
      ['Science 2', null, null, null, 'RASHMI', null, null, null, null, null, null],
      ['Physics', null, null, null, null, null, null, 'SONAM', 'PANKAJ', 'PANKAJ', 'PANKAJ'],
      ['Chemistry', null, null, null, null, null, null, 'SONAM', 'PANKAJ', 'SONAM', 'SONAM'],
      ['Biology', null, null, null, null, null, null, 'RASHMI', 'RASHMI', 'RASHMI', 'RASHMI'],
      ['History', 'AFTAB', 'YOGESH', 'YOGESH', 'YOGESH', 'SMITA', 'YOGESH', 'YOGESH', 'YOGESH', 'YOGESH', 'YOGESH'],
      ['Geography', 'AFTAB', 'YOGESH', 'YOGESH', 'YOGESH', 'SMITA', 'YOGESH', 'YOGESH', 'YOGESH', 'YOGESH', 'YOGESH']
    ];
    const batchNames = ['STATE 7', 'STATE 8', 'STATE 9', 'STATE 10', 'CBSE 8', 'CBSE 9', 'CBSE 10', 'ICSE 8', 'ICSE 9', 'ICSE 10'];

    for (const row of matrix) {
      const subjectName = row[0];
      const subject = await prisma.subject.findFirst({ where: { name: subjectName } });
      for (let i = 0; i < batchNames.length; i++) {
        const teacherName = row[i + 1];
        if (teacherName) {
          const batch = await prisma.batch.findUnique({ where: { name: batchNames[i] } });
          const teacher = await prisma.teacher.findUnique({ where: { name: teacherName } });
          if (batch && subject && teacher) {
            const existingMapping = await prisma.batchSubjectTeacher.findFirst({
              where: { batchId: batch.id, subjectId: subject.id }
            });
            if (!existingMapping) {
              await prisma.batchSubjectTeacher.create({
                data: { batchId: batch.id, subjectId: subject.id, teacherId: teacher.id }
              });
            }
          }
        }
      }
    }
    res.json({ success: true, message: 'Database seeded successfully from Vercel!' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post('/timetable/generate', async (req, res) => {
  try {
    const { weekStartDate, adHocHolidays = [] } = req.body;
    const week = await generateWeek(weekStartDate, adHocHolidays);
    res.json(week);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get('/timetable/weeks', async (req, res) => {
  try {
    const weeks = await prisma.timetableWeek.findMany({
      orderBy: { weekStartDate: 'desc' }
    });
    res.json(weeks);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get('/timetable/week/:id', async (req, res) => {
  try {
    const week = await prisma.timetableWeek.findUnique({
      where: { id: Number(req.params.id) },
      include: { entries: { include: { subject: true, teacher: true, batch: true } } }
    });
    res.json(week);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.delete('/timetable/week/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.timetableEntry.deleteMany({ where: { weekId: id } });
    await prisma.timetableWeek.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get('/timetable/fortnights', async (req, res) => {
  try {
    const fortnights = await prisma.timetableFortnight.findMany({
      orderBy: { startDate: 'desc' },
      include: { weeks: true }
    });
    res.json(fortnights);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get('/timetable/fortnight-coverage-by-id/:fortnightId', async (req, res) => {
  try {
    const fortnight = await prisma.timetableFortnight.findUnique({
      where: { id: Number(req.params.fortnightId) },
      include: { weeks: { include: { entries: true } } }
    });

    if (!fortnight) return res.status(404).json({ error: 'Fortnight not found' });

    const pastCounts: Record<number, Record<number, number>> = {};
    for (const w of fortnight.weeks) {
      for (const entry of w.entries) {
        if (entry.subjectId) {
          if (!pastCounts[entry.batchId]) pastCounts[entry.batchId] = {};
          pastCounts[entry.batchId][entry.subjectId] = (pastCounts[entry.batchId][entry.subjectId] || 0) + 1;
        }
      }
    }

    res.json(pastCounts);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.put('/timetable/entry/:id', async (req, res) => {
  try {
    const { subjectId } = req.body;
    
    const entry = await prisma.timetableEntry.findUnique({
      where: { id: Number(req.params.id) }
    });
    
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    
    if (subjectId === null) {
      const updated = await prisma.timetableEntry.update({
        where: { id: entry.id },
        data: { subjectId: null, teacherId: null, unresolved: true }
      });
      return res.json(updated);
    }
    
    const mapping = await prisma.batchSubjectTeacher.findFirst({
      where: {
        batchId: entry.batchId,
        subjectId: subjectId
      }
    });

    if (!mapping) {
      return res.status(400).json({ error: 'No teacher mapped for this subject' });
    }

    const updated = await prisma.timetableEntry.update({
      where: { id: entry.id },
      data: {
        subjectId: mapping.subjectId,
        teacherId: mapping.teacherId,
        unresolved: false
      }
    });
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Calculate fortnight coverage for a given week
router.get('/timetable/fortnight-coverage/:weekId', async (req, res) => {
  try {
    const week = await prisma.timetableWeek.findUnique({
      where: { id: Number(req.params.weekId) },
      include: { entries: true, fortnight: { include: { weeks: { include: { entries: true } } } } }
    });

    if (!week) return res.status(404).json({ error: 'Week not found' });

    const pastCounts: Record<number, Record<number, number>> = {};
    if (week.fortnight) {
      for (const w of week.fortnight.weeks) {
        for (const entry of w.entries) {
          if (entry.subjectId) {
            if (!pastCounts[entry.batchId]) pastCounts[entry.batchId] = {};
            pastCounts[entry.batchId][entry.subjectId] = (pastCounts[entry.batchId][entry.subjectId] || 0) + 1;
          }
        }
      }
    }

    res.json(pastCounts);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
