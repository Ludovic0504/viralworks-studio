import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('demo1234', 10)
  const user = await prisma.user.upsert({
    where: { email: 'demo@onetool.dev' },
    update: {},
    create: {
      email: 'demo@onetool.dev',
      passwordHash,
    },
  })

  if (!existingUser) {
  await prisma.user.create({
    data: {
      email: 'demo@onetool.dev',
      passwordHash: '...',
      workspaces: {
        create: {
          name: 'Bureau de Démo',
          members: { create: { role: 'owner' } },
        },
      },
    },
  })
}


  // 2) Workspace + membre + item de bienvenue
  const ws = await prisma.workspace.create({
    data: {
      name: 'Bureau de Jean',
      members: {
        create: {
          userId: user.id,
          role: 'owner',          
        },
      },
      items: {
        create: [
          {
            title: 'Bienvenue 👋',
            type: 'note',
            data: { content: 'Hello OneTool' },
          },
        ],
      },
    },
  })

  console.log('✅ Seed terminé avec succès !', { user, ws })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
