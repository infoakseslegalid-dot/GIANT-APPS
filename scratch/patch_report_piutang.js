const fs = require("fs");
let code = fs.readFileSync("src/server/routes_report.ts", "utf-8");

code = code.replace(
  "let total_in = 0;",
  "let total_in = 0;\n  let total_piutang = 0;\n  let piutang_cards = 0;"
);

code = code.replace(
  "else if (info.status === 'belum') count_belum += 1;",
  "else if (info.status === 'belum') count_belum += 1;\n\n    if (info.outstanding && info.outstanding > 0) {\n      total_piutang += info.outstanding;\n      piutang_cards += 1;\n    }"
);

code = code.replace(
  "count_lunas_total, count_dp, count_belum,",
  "count_lunas_total, count_dp, count_belum, total_piutang, piutang_cards,"
);

fs.writeFileSync("src/server/routes_report.ts", code);
