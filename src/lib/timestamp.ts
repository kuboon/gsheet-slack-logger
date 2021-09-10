/*
組み込みの Date 型は env.TZ の値を見てタイムゾーンを勝手に変換する。
TZはグローバルに1つでインスタンス毎の変更は出来ない。
*/
import date_fns from 'date-fns-tz'
const { format, utcToZonedTime, zonedTimeToUtc } = date_fns

const SheetDate = {
  origin: Date.UTC(1899, 11, 30, 0, 0, 0, 0),
  dayToMs: 24 * 60 * 60 * 1000,
};
export class Timestamp extends Date {
  static fromZoned(d: Date, timeZone: string) {
    const utc = zonedTimeToUtc(d, timeZone);
    return new Timestamp(utc);
  }
  static fromSlack(ts: string) {
    if (!ts) return;
    return new Timestamp(Number(ts) * 1000);
  }
  static fromGsheetSerial(d: number, timeZone: string): Timestamp {
    return new Timestamp(
      zonedTimeToUtc(
        // シリアル値のままだと変換されない
        new Date(d * SheetDate.dayToMs + SheetDate.origin),
        timeZone,
      ),
    );
  }

  format(fmt: string, timeZone: string) {
    //{timeZone} is for zzz
    return format(utcToZonedTime(this, timeZone), fmt, { timeZone });
  }

  date(timeZone: string) {
    return this.format("yyyy-MM-dd", timeZone);
  }
  hourMin(timeZone: string) {
    return this.format("H:mm", timeZone);
  }

  slack() {
    return (this.getTime() / 1000).toString()
  }
  gsheetSerial(timeZone: string) {
    const msec = utcToZonedTime(this, timeZone).getTime() - SheetDate.origin;
    return msec / SheetDate.dayToMs;
  }
}
