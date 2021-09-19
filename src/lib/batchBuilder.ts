import { sheets_v4 } from "./google/sheet.js";

export class BatchBuilder {
  batches: sheets_v4.Schema$Request[] = []
  rows: sheets_v4.Schema$RowData[] = []
  estimate = 0
  sheetId: number = 0
  push(row: sheets_v4.Schema$RowData) {
    this.rows.push(row)
    this.estimate += JSON.stringify(row).length + 3
    return this.estimate
  }
  setSheetId(sheetId: number) {
    if (this.rows.length > 0) {
      const req: sheets_v4.Schema$Request = { appendCells: { sheetId: this.sheetId, rows: this.rows, fields: '*' } }
      this.batches.push(req)
      this.batches.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: this.sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: 4,
          },
        },
      })
      this.rows = []
    }
    this.sheetId = sheetId
  }
  flush() {
    if (this.rows.length > 0) {
      const req: sheets_v4.Schema$Request = { appendCells: { sheetId: this.sheetId, rows: this.rows, fields: '*' } }
      this.batches.push(req)
      this.rows = []
    }
    const batches = this.batches
    this.batches = []
    this.estimate = 0
    return batches
  }
}
