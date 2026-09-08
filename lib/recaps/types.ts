export type SessionRecapHighlight={type:string;title:string;detail:string};
export type SessionRecapMetrics={participants:number;messages:number;rolls:number;natural20s:number;narrations:number;combatActions:number;damage:number};
export type SessionRecap={id:string;table_id:string;sequence:number;generated_by:string;title:string;summary_th:string;highlights:SessionRecapHighlight[];metrics:SessionRecapMetrics;started_at:string;ended_at:string;created_at:string};
