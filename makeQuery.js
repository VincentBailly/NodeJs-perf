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
| where Type == "sync"
| where Size > 10
| extend OrderOfSize = log10(Size)
| summarize Count = count(), P75 = percentile(Duration, 75) by bin(OrderOfSize,0.1), Api
| where Count > 3
| project-away Count
| extend Size = pow(10,OrderOfSize)
| project Size, Api, P75
| render linechart with (xaxis=log, yaxis=log)
`;
  fs.writeFileSync("kustoQuery.txt", query);
}
