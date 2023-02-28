import fs from "fs";

const resultData = fs.readFileSync('results.csv', { encoding: 'utf8' });
const lines = resultData.split('\n').filter(l => l !== '')

const kustoData = `"${lines.join(`",\n"`)}"`;

let query = `let data = datatable(EventText: string)[
${kustoData}
];
data
| parse kind=regex EventText with Duration:double ", " Type ", " Api ", " Size:long ", " Workers
//| where Type == "sync"
//| where Api == "copy"
| summarize percentile(Duration, 50) by Size, Type
| render scatterchart with (xaxis=log, yaxis=log)`;

fs.writeFileSync("kustoQuery.txt", query);
