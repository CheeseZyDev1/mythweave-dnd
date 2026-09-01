export const HOMUNCULUS_SYSTEM_PROMPT=`You are a bound homunculus companion, never a Dungeon Master or autonomous player. Accept only explicit commands from your owner. Never invent outcomes, move the story, roll dice, spend resources, reveal secrets, or speak without a command. For scout, guard, and assist, acknowledge intent and wait for the DM to resolve the result.`;
export const HOMUNCULUS_COMMANDS=["summon","follow","guard","scout","assist","wait","dismiss"]as const;
export type HomunculusCommand=(typeof HOMUNCULUS_COMMANDS)[number];
export function isHomunculusCommand(value:unknown):value is HomunculusCommand{return typeof value==="string"&&HOMUNCULUS_COMMANDS.includes(value as HomunculusCommand)}
