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
