import { APPEARANCE_OPTIONS, CLASSES, type Appearance } from "../../lib/characters/catalog";

type Props = { appearance: Appearance; race: string; characterClass: string; name?: string };

export function CharacterAvatar({ appearance, race, characterClass, name = "ตัวละคร" }: Props) {
  const skin = APPEARANCE_OPTIONS.skinTone.find((item) => item.id === appearance.skinTone)?.color ?? "#c88f69";
  const hair = APPEARANCE_OPTIONS.hairColor.find((item) => item.id === appearance.hairColor)?.color ?? "#171c1c";
  const classInfo = CLASSES.find((item) => item.id === characterClass) ?? CLASSES[0];
  const bodyHalf = appearance.body === "slim" ? 55 : appearance.body === "broad" ? 78 : 66;
  const headRx = appearance.face === "round" ? 43 : appearance.face === "sharp" ? 35 : 39;
  const eyeColor = race === "fallen" ? "#d9bd75" : race === "goblin" ? "#d7c55c" : "#29322f";

  return (
    <svg aria-label={`ภาพตัวละคร ${name}`} className="character-avatar" role="img" viewBox="0 0 240 320">
      <defs>
        <radialGradient id="avatar-aura" cx="50%" cy="38%" r="70%"><stop offset="0" stopColor={classInfo.color} stopOpacity=".5" /><stop offset=".7" stopColor="#07120f" stopOpacity=".2" /><stop offset="1" stopColor="#020806" /></radialGradient>
        <linearGradient id="avatar-cloak" x1="0" x2="1" y1="0" y2="1"><stop stopColor={classInfo.color} /><stop offset="1" stopColor="#17231e" /></linearGradient>
        <filter id="avatar-glow"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <rect width="240" height="320" rx="8" fill="url(#avatar-aura)" />
      <circle cx="120" cy="115" r="74" fill={classInfo.color} opacity=".12" filter="url(#avatar-glow)" />
      {race === "fallen" && <><path d="M78 61 Q120 38 162 61" fill="none" stroke="#d9bd75" strokeDasharray="8 7" strokeWidth="3" /><circle cx="120" cy="48" r="33" fill="none" stroke="#d9bd75" strokeOpacity=".18" /></>}
      <path d={`M${120 - bodyHalf} 300 Q${120 - bodyHalf - 5} 226 83 207 Q120 192 157 207 Q${120 + bodyHalf + 5} 226 ${120 + bodyHalf} 300Z`} fill="url(#avatar-cloak)" stroke="#d9bd75" strokeOpacity=".24" />
      <path d="M93 210 Q120 231 147 210 L158 300 L82 300Z" fill="#0e1815" opacity=".55" />
      <rect x="105" y="174" width="30" height="44" rx="13" fill={skin} />
      {(race === "elf" || race === "goblin") && <><path d="M82 105 L32 89 Q54 126 87 135Z" fill={skin} stroke="#342b24" strokeOpacity=".45" /><path d="M158 105 L208 89 Q186 126 153 135Z" fill={skin} stroke="#342b24" strokeOpacity=".45" /></>}
      {race === "half_orc" && <><path d="M83 112 L57 101 L84 137Z" fill={skin} /><path d="M157 112 L183 101 L156 137Z" fill={skin} /></>}
      <ellipse cx="120" cy="126" rx={headRx} ry={appearance.face === "round" ? 49 : 55} fill={skin} stroke="#281f1a" strokeOpacity=".35" />
      <path d="M92 126 Q103 119 112 126" fill="none" stroke="#30261f" strokeWidth="3" strokeLinecap="round" /><path d="M128 126 Q137 119 148 126" fill="none" stroke="#30261f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="103" cy="128" r="3" fill={eyeColor} /><circle cx="137" cy="128" r="3" fill={eyeColor} />
      <path d="M120 130 L116 148 Q120 151 125 148" fill="none" stroke="#49362d" strokeOpacity=".62" strokeWidth="2" />
      <path d="M108 161 Q120 168 132 161" fill="none" stroke="#5b322f" strokeWidth="2" strokeLinecap="round" />
      {race === "half_orc" && <><path d="M103 159 L108 149 L112 161Z" fill="#e7d8b7" /><path d="M128 161 L132 149 L137 159Z" fill="#e7d8b7" /></>}
      {appearance.hairStyle === "short" && <path d="M82 126 Q77 75 120 69 Q164 76 158 125 Q145 96 128 95 Q108 109 82 126Z" fill={hair} />}
      {appearance.hairStyle === "long" && <><path d="M80 132 Q72 73 120 67 Q170 72 160 134 L169 194 Q151 180 145 154 L94 154 Q89 182 72 197Z" fill={hair} /><path d="M91 106 Q118 79 154 97" fill="none" stroke="#ffffff" strokeOpacity=".08" strokeWidth="5" /></>}
      {appearance.hairStyle === "braid" && <><path d="M82 125 Q78 77 120 69 Q162 76 158 126 Q136 92 120 96 Q102 92 82 125Z" fill={hair} /><path d="M154 104 Q175 145 159 204 Q177 216 159 228 Q143 214 158 199 Q168 147 149 111Z" fill={hair} /><circle cx="159" cy="226" r="6" fill={classInfo.color} /></>}
      {appearance.hairStyle === "mohawk" && <path d="M105 79 Q119 30 134 79 L142 102 Q121 91 98 103Z" fill={hair} />}
      {race === "dwarf" && <path d="M93 156 Q92 203 120 215 Q148 202 147 156 Q138 178 120 183 Q102 178 93 156Z" fill={hair} opacity=".92" />}
      <circle cx="120" cy="255" r="24" fill="#07100d" stroke="#d9bd75" strokeOpacity=".34" />
      <text x="120" y="264" fill="#e2c573" fontFamily="serif" fontSize="27" textAnchor="middle">{classInfo.icon}</text>
      <path d="M28 292 H82 M158 292 H212" stroke="#d9bd75" strokeOpacity=".34" />
    </svg>
  );
}
