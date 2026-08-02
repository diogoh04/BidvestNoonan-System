// Cria/atualiza uma conta de login. Uso pontual — o SQL editor do Neon não
// gera hash de senha, então a primeira conta master (e outras iniciais)
// precisam ser criadas por aqui.
//
// Uso:
//   npx tsx scripts/seed-user.ts <username> <password> <master|supervisor|team_leader> [staffId]
//
// Exemplo (primeira conta master):
//   npx tsx scripts/seed-user.ts admin "senha-forte-aqui" master
//
// Exemplo (team leader vinculado ao Staff de id 42):
//   npx tsx scripts/seed-user.ts joao.silva "outra-senha" team_leader 42

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [username, password, role, staffIdArg] = process.argv.slice(2);

  if (!username || !password || !role) {
    console.error(
      "Uso: npx tsx scripts/seed-user.ts <username> <password> <master|supervisor|team_leader> [staffId]"
    );
    process.exit(1);
  }

  if (!["master", "supervisor", "team_leader"].includes(role)) {
    console.error(`Papel inválido: ${role}. Use master, supervisor ou team_leader.`);
    process.exit(1);
  }

  if (role === "team_leader" && !staffIdArg) {
    console.error("Contas team_leader precisam do staffId do Staff já cadastrado como team leader.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      role,
      staffId: staffIdArg ? BigInt(staffIdArg) : null,
      active: true,
    },
    create: {
      username,
      passwordHash,
      role,
      staffId: staffIdArg ? BigInt(staffIdArg) : null,
    },
  });

  console.log(`Usuário "${user.username}" (${user.role}) criado/atualizado com sucesso. id=${user.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
