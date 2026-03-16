import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: "admin" },
      update: {},
      create: {
        username: "admin",
        passwordHash,
        name: "系统管理员",
        role: "ADMIN",
        email: "admin@example.com"
      }
    }),
    prisma.user.upsert({
      where: { username: "manager" },
      update: {},
      create: {
        username: "manager",
        passwordHash,
        name: "项目经理",
        role: "MANAGER",
        email: "manager@example.com"
      }
    }),
    prisma.user.upsert({
      where: { username: "engineer" },
      update: {},
      create: {
        username: "engineer",
        passwordHash,
        name: "电气工程师",
        role: "ENGINEER",
        email: "engineer@example.com"
      }
    }),
    prisma.user.upsert({
      where: { username: "reviewer" },
      update: {},
      create: {
        username: "reviewer",
        passwordHash,
        name: "设计审核员",
        role: "REVIEWER",
        email: "reviewer@example.com"
      }
    })
  ]);

  const manager = users.find((item) => item.username === "manager");
  const engineer = users.find((item) => item.username === "engineer");

  const project = await prisma.project.upsert({
    where: { code: "PRJ-EL-001" },
    update: {},
    create: {
      name: "智能配电柜研发",
      code: "PRJ-EL-001",
      description: "用于工业园区的新一代智能配电柜设计项目",
      status: "IN_PROGRESS",
      startDate: new Date("2026-01-10"),
      endDate: new Date("2026-07-31"),
      managerId: manager.id
    }
  });

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: engineer.id
      }
    },
    update: {},
    create: {
      projectId: project.id,
      userId: engineer.id
    }
  });

  const component = await prisma.component.upsert({
    where: { partNumber: "RL-24V-10A" },
    update: {},
    create: {
      name: "中间继电器",
      partNumber: "RL-24V-10A",
      category: "继电器",
      specification: "线圈24V，触点10A",
      packageType: "DIN 导轨",
      voltageRating: 24,
      powerRating: 2.5,
      price: 18.6,
      manufacturer: "华电元件"
    }
  });

  let bom = await prisma.bom.findFirst({
    where: {
      name: "主回路BOM",
      projectId: project.id
    }
  });

  if (!bom) {
    bom = await prisma.bom.create({
      data: {
        name: "主回路BOM",
        stage: "方案设计",
        version: 1,
        projectId: project.id,
        createdById: manager.id
      }
    });
  }

  const existsItem = await prisma.bomItem.findFirst({
    where: {
      bomId: bom.id,
      componentId: component.id
    }
  });

  if (!existsItem) {
    await prisma.bomItem.create({
      data: {
        bomId: bom.id,
        componentId: component.id,
        quantity: 20,
        unitPrice: 18.6,
        supplier: "深圳精工电子"
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    process.stderr.write(`${error?.stack || error?.message || "种子数据初始化失败"}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
