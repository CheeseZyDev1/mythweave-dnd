export type WorldBoss={id:string;slug:string;name_th:string;title_th:string;phase:number;hp_max:number;hp_current:number;status:"active"|"defeated"|"ended";starts_at:string;ends_at:string;updated_at:string};
export type WorldBossContribution={id:string;boss_id:string;table_id:string;user_id:string;character_id:string;character_name:string;damage:number;boss_hp_after:number;created_at:string};
