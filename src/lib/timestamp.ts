

export class Timestamp extends Date {
  static fromSlack(ts: string) {
    if (!ts) return;
    return new Timestamp(Number(ts) * 1000);
  }

  // format(fmt: string, timeZone: string) {
  //   //{timeZone} is for zzz
  //   return format(utcToZonedTime(this, timeZone), fmt, { timeZone });
  // }

  date(timeZone: string) {
    const zoned = this.toTemporalInstant().toZonedDateTimeISO(timeZone);
    return zoned.toPlainDate().toString();
    // return this.format("yyyy-MM-dd", timeZone);
  }

  // returns "09:05"
  hourMin(timeZone: string) {
    const zoned = this.toTemporalInstant().toZonedDateTimeISO(timeZone);
    return zoned.toPlainTime().toString({ smallestUnit: "minute" });
  }

  slack() {
    return (this.getTime() / 1000).toString();
  }
  gsheetSerial(timeZone: string) {
    return ExcelDate.fromDate(this, timeZone);
  }
}

const SheetDate = {
  origin: Temporal.PlainDateTime.from({ year: 1899, month: 12, day: 30, }),
  dayToMs: 24 * 60 * 60 * 1000,
};
export const ExcelDate = {
  from(plain: Temporal.PlainDateTime): number {
    return SheetDate.origin.until(plain).total({ unit: 'milliseconds' }) / SheetDate.dayToMs;
  },
  toPlain(serial: number): Temporal.PlainDateTime {
    return SheetDate.origin.add({ milliseconds: Math.floor(serial * SheetDate.dayToMs) });
  },
  fromDate(date: Date, timeZone: Temporal.TimeZoneLike): number {
    const plain = date.toTemporalInstant().toZonedDateTimeISO(timeZone).toPlainDateTime();
    return ExcelDate.from(plain);
  },
  toDate(serial: number, timeZone: Temporal.TimeZoneLike): Date {
    const plainDateTime = this.toPlain(serial);
    const ms = plainDateTime.toZonedDateTime(timeZone).toInstant().epochMilliseconds;
    return new Date(ms);
  }
}
Deno.test({
  name: 'gsheetSerial',
  fn: () => {
    const tz = 'Asia/Tokyo';
    const date = new Date();
    const serial = ExcelDate.fromDate(date, tz);
    const date2 = ExcelDate.toDate(serial, tz);
    console.log({ date, serial, date2 });
  }
})
