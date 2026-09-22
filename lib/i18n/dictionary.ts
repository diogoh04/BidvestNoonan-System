// Dicionário PT — só usado pela conta "team_leader" (ver LanguageToggle).
// Chave = string em inglês exatamente como aparece no código; sem entrada
// aqui, `t()` devolve a própria chave (fallback seguro). Cobre só telas de
// interface — a folha de ponto impressa (Sign In & Sign Out Book, dias da
// semana, códigos HP/AA/S/HU/AU/BH/P45) fica em inglês de propósito, é o
// documento oficial que Master/Supervisor também usam.
export const pt: Record<string, string> = {
  // Header / navegação / dashboard
  Back: "Voltar",
  "My Profile": "Meu Perfil",
  Logout: "Sair",
  "Select a view": "Selecione uma visão",
  "My Buildings": "Meus Prédios",
  "Buildings under your responsibility": "Prédios sob sua responsabilidade",
  "My Timesheets": "Minhas Folhas de Ponto",
  "Log and track timesheets": "Lance e acompanhe as folhas de ponto",

  // Termos comuns reaproveitados em várias telas
  Team: "Time",
  Building: "Prédio",
  Save: "Salvar",
  Cancel: "Cancelar",
  Confirm: "Confirmar",
  Delete: "Excluir",
  "Loading...": "Carregando...",
  "Saving...": "Salvando...",
  "Saving…": "Salvando…",
  Week: "Semana",
  Fortnight: "Quinzena",
  by: "por",
  of: "de",
  week: "semana",
  fortnight: "quinzena",
  "yet.": "ainda.",
  "building(s)": "prédio(s)",
  "This action cannot be undone.": "Essa ação não pode ser desfeita.",
  draft: "rascunho",
  submitted: "enviado",
  done: "concluído",

  // My Buildings (/my)
  "building(s) under your responsibility.": "prédio(s) sob sua responsabilidade.",
  "Your account isn't linked to a team yet. Ask the Master to link it in Users.":
    "Sua conta ainda não está vinculada a um time. Peça ao Master para vincular em Usuários.",
  "No building assigned to your account yet.": "Nenhum prédio atribuído à sua conta ainda.",
  "No cleaner assigned to this building.": "Nenhum cleaner atribuído a este prédio.",

  // BuildingStaffClient (reordenar / Sheet labels)
  "Order:": "Ordem:",
  "Manual (drag to reorder)": "Manual (arraste para reordenar)",
  "Automatic (by hours) — drag to reorder": "Automática (por horas) — arraste para reordenar",
  "Reset to automatic": "Voltar para automático",
  "Sheet labels": "Rótulos da folha",
  "Drag to reorder": "Arraste para reordenar",
  "Open slot": "Vaga em aberto",
  "no hours set": "sem horas definidas",
  Sheet: "Folha",
  "Fill slot": "Preencher vaga",
  "Could not fill this slot": "Não foi possível preencher esta vaga",

  // StaffRow (notas)
  Notes: "Notas",
  "Write a note...": "Escreva uma nota...",
  "No notes yet.": "Nenhuma nota ainda.",
  "Failed to save note": "Não foi possível salvar a nota",
  "Attach photo": "Anexar foto",
  Remove: "Remover",
  "Failed to upload photo": "Não foi possível enviar a foto",
  "Image is too large (max 8MB)": "Imagem muito grande (máx. 8MB)",
  "Only image files are allowed": "Só são permitidos arquivos de imagem",
  "Failed to delete note": "Não foi possível excluir a nota",
  "Failed to delete entry": "Não foi possível excluir o registro",
  "Failed to delete": "Não foi possível excluir",

  // My Timesheets — hub / abas / ajustes
  "Start a new fortnight, or review what's already logged.":
    "Comece uma quinzena nova ou revise o que já foi lançado.",
  "New fortnight": "Nova quinzena",
  "Fortnightly sheets": "Folhas quinzenais",
  "Weekly (legacy)": "Semanal (legado)",
  Adjustments: "Ajustes",
  "Launched (legacy)": "Lançadas (legado)",
  Launched: "Lançada",
  "New adjustment": "Novo ajuste",
  "No adjustment reports yet.": "Nenhum relatório de ajuste ainda.",
  "Delete the adjustment report for week": "Excluir o relatório de ajuste da semana",
  "Delete report": "Excluir relatório",
  item: "item",
  items: "itens",

  // My Timesheets — lista de folhas lançadas
  "Delete the whole timesheet for the": "Excluir a folha inteira da",
  "From fortnight": "Da quinzena",
  Draft: "Rascunho",
  "Submitted — awaiting review": "Enviado — aguardando revisão",
  Done: "Concluído",
  "No timesheet logged yet.": "Nenhuma folha lançada ainda.",
  "No fortnight logged yet. Use “New fortnight”.": "Nenhuma quinzena lançada ainda. Use “Nova quinzena”.",
  "No weekly sheet.": "Nenhuma folha semanal.",
  "Could not delete some buildings from this week": "Não foi possível excluir alguns prédios desta semana",

  // Lancar (criar/abrir quinzena)
  "Start date": "Data início",
  "End date": "Data fim",
  days: "dias",
  "or open a logged one:": "ou abra uma já lançada:",
  "Select an already logged fortnight...": "Selecione uma quinzena já lançada...",
  "weekly, legacy": "semanal, legado",
  "Send to supervisor": "Enviar para o supervisor",
  "Sending...": "Enviando...",
  "Could not load your profile. Please try again.": "Não foi possível carregar seu perfil. Tente novamente.",
  "No fortnight logged for": "Nenhuma quinzena lançada para",
  "Start blank": "Começar em branco",
  "Copy from previous fortnight": "Copiar da quinzena anterior",
  "Sent to the supervisor — the forecast is locked. Changes during the fortnight go in an":
    "Enviado para o supervisor — a previsão está travada. Mudanças durante a quinzena entram em um",
  "adjustment report": "relatório de ajuste",
  "Log timesheet": "Lançar ponto",
  "All your buildings together, in one fortnight — same as the sheet that would be printed.":
    "Todos os seus prédios juntos, numa quinzena só — igual à folha que seria impressa.",

  // CombinedTimesheetEditor (chrome — fora da folha impressa)
  Submitted: "Enviado",
  "Print / Export PDF": "Imprimir / Exportar PDF",
  "Auto-fill hours": "Preencher horários automaticamente",
  "Swipe the table sideways to see all days →": "Deslize a tabela para o lado para ver todos os dias →",
  "Search staff...": "Buscar funcionário...",
  Hours: "Horas",
  "Add cover": "Adicionar cobertura",
  "Could not save": "Não foi possível salvar",

  // My Profile / trocar senha
  "Login:": "Usuário:",
  Password: "Senha",
  "Reset password": "Redefinir senha",
  "Password reset": "Senha redefinida",
  "New password": "Nova senha",
  "Confirm password": "Confirmar senha",
  "Passwords don't match.": "As senhas não coincidem.",
  "Could not reset the password.": "Não foi possível redefinir a senha.",

  // Adjustment reports
  "Changes during the fortnight — sent to the supervisor once a week.":
    "Mudanças durante a quinzena — enviadas ao supervisor uma vez por semana.",
  "Adjustment report": "Relatório de ajuste",
  "Week starting": "Semana começando em",
  "Week (Monday)": "Semana (segunda-feira)",
  "Creating...": "Criando...",
  "Start report": "Iniciar relatório",
  "Save or cancel the open item first": "Salve ou cancele o item aberto primeiro",
  Action: "Ação",
  Staff: "Funcionário",
  "Select from forecast...": "Selecionar da previsão...",
  "From date": "Data inicial",
  "Effective date": "Data efetiva",
  "To date": "Data final",
  Time: "Horário",
  Reason: "Motivo",
  cover: "cobertura",
  "Note (optional)": "Nota (opcional)",
  "Save adjustment": "Salvar ajuste",
  "Add adjustment": "Adicionar ajuste",
  Report: "Relatório",
  Saved: "Salvo",
  "Could not create the report": "Não foi possível criar o relatório",
  "Could not send": "Não foi possível enviar",

  // Fortnight plan (legado, lançamentos antigos)
  "Original forecast launched on": "Previsão original lançada em",
  "read-only. Changes now happen on the weekly sheets below.":
    "somente leitura. Mudanças agora acontecem nas folhas semanais abaixo.",
  "View Week 1": "Ver Semana 1",
  "View Week 2": "Ver Semana 2",
};
