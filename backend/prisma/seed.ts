import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database...');

  // 1. Seed Teachers
  const teachers = ['Yogesh', 'Sadika', 'Virendra', 'Sonam', 'Smita', 'Harshala', 'Deepti', 'Pankaj', 'Sujata', 'Gargi', 'Akash', 'Prahlad', 'Rashmi', 'Aftab'];
  for (const name of teachers) {
    await prisma.teacher.upsert({
      where: { name: name.toUpperCase() },
      update: {},
      create: { name: name.toUpperCase() }
    });
  }

  // 2. Seed Subjects
  const subjectsData = [
    { name: 'English', type: 'language' },
    { name: 'Hindi', type: 'language' },
    { name: 'Sanskrit', type: 'core' },
    { name: 'Marathi', type: 'language' },
    { name: 'Math', type: 'core' },
    { name: 'Math 1', type: 'core' },
    { name: 'Math 2', type: 'core' },
    { name: 'Science', type: 'core' },
    { name: 'Science 1', type: 'core' },
    { name: 'Science 2', type: 'core' },
    { name: 'Physics', type: 'core' },
    { name: 'Chemistry', type: 'core' },
    { name: 'Biology', type: 'core' },
    { name: 'History', type: 'core' },
    { name: 'Geography', type: 'core' }
  ];

  for (const sub of subjectsData) {
    const existing = await prisma.subject.findFirst({ where: { name: sub.name } });
    if (!existing) {
      await prisma.subject.create({ data: { name: sub.name, type: sub.type } });
    }
  }

  // 3. Seed Batches
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
    await prisma.batch.upsert({
      where: { name: b.name },
      update: {},
      create: b
    });
  }

  // 4. Seed Mapping (Batch x Subject x Teacher)
  // Format based on the prompt's matrix
  const matrix = [
    // Subject, STATE 7, STATE 8, STATE 9, STATE 10, CBSE 8, CBSE 9, CBSE 10, ICSE 8, ICSE 9, ICSE 10
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
          // Check if mapping exists
          const existingMapping = await prisma.batchSubjectTeacher.findFirst({
            where: { batchId: batch.id, subjectId: subject.id }
          });
          if (!existingMapping) {
            await prisma.batchSubjectTeacher.create({
              data: {
                batchId: batch.id,
                subjectId: subject.id,
                teacherId: teacher.id
              }
            });
          }
        }
      }
    }
  }

  console.log('Seeding Complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
