import fs from "fs";


export function makeQuery() {
  const resultData = fs.readFileSync('results.csv', { encoding: 'utf8' });
  const lines = resultData.split('\n').filter(l => l !== '')

  const kustoData = `"${lines.join(`",\n"`)}"`;

  let query = `let data = datatable(EventText: string)[
${kustoData}
];
data
| parse kind=regex EventText with Duration:double ", " Type ", " Api ", " Size:long ", " Workers:long ", " Concurrency:long
| where Type == "promise"
| where Size > 10
| extend OrderOfSize = log10(Size)
| summarize Count = count(), percentile(Duration, 50) by bin(OrderOfSize,0.1), tostring(Concurrency)
| where Count > 3
| project-away Count
| extend Size = pow(10,OrderOfSize)
| project Size, Concurrency, percentile_Duration_50
| render scatterchart with (xaxis=log, yaxis=log)`;

  fs.writeFileSync("kustoQuery.txt", query);
}
