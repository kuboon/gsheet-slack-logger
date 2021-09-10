export type CellVal = number | string | boolean | Date | null;
export type ValMatrix = CellVal[][];
export type KeyVal = { [key: string]: CellVal };
export type KeyValOrArray = { [key: string]: CellVal | CellVal[] };
