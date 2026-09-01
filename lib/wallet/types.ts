export type WalletTransaction={id:string;character_id:string;user_id:string;delta_copper:number;balance_after:number;reason:string;created_at:string};
export function splitCoins(total:number){let rest=Math.max(0,total);const platinum=Math.floor(rest/1000);rest%=1000;const gold=Math.floor(rest/100);rest%=100;const silver=Math.floor(rest/10);return{platinum,gold,silver,copper:rest%10};}

