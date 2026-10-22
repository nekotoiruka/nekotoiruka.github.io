// モーション見本帳で、武器ごとに選んでもらった案（項目 → 武器 → 案。先頭が第一候補）。討伐画面の、ボスの攻撃への対応で使う
// 見本帳で選び直したら、ここを書き直す
export const MOTION_PICKS = {
    "awaken": {
        "axe": [
            "awaken-dark"
        ],
        "blaster": [
            "awaken-halo"
        ],
        "book": [
            "awaken-giant"
        ],
        "bow": [
            "awaken-halo"
        ],
        "dagger": [
            "awaken-flame"
        ],
        "fan": [
            "awaken-gold"
        ],
        "guitar": [
            "awaken-halo"
        ],
        "hammer": [
            "awaken-flame"
        ],
        "katana": [
            "awaken-dark"
        ],
        "pan": [
            "awaken-flame"
        ],
        "scythe": [
            "awaken-giant"
        ],
        "shield": [
            "awaken-halo"
        ],
        "spear": [
            "awaken-dark"
        ],
        "sword": [
            "awaken-gold"
        ],
        "umbrella": [
            "awaken-halo"
        ],
        "wand": [
            "awaken-thunder",
            "awaken-giant"
        ]
    },
    "blunt": {
        "axe": [
            "blunt-spin"
        ],
        "guitar": [
            "blunt-upper"
        ],
        "hammer": [
            "blunt-leap"
        ],
        "pan": [
            "blunt-homerun"
        ],
        "shield": [
            "blunt-quake"
        ]
    },
    "evade": {
        "axe": [
            "evade-back",
            "evade-duck"
        ],
        "blaster": [
            "evade-duck",
            "evade-roll"
        ],
        "book": [
            "evade-back",
            "evade-phase"
        ],
        "bow": [
            "evade-back",
            "evade-roll"
        ],
        "dagger": [
            "evade-ghost",
            "evade-log"
        ],
        "fan": [
            "evade-ghost",
            "evade-log"
        ],
        "guitar": [
            "evade-log",
            "evade-phase"
        ],
        "hammer": [
            "evade-roll",
            "evade-duck"
        ],
        "katana": [
            "evade-ghost",
            "evade-roll"
        ],
        "pan": [
            "evade-ghost",
            "evade-duck"
        ],
        "scythe": [
            "evade-duck",
            "evade-roll"
        ],
        "shield": [
            "evade-duck",
            "evade-roll"
        ],
        "spear": [
            "evade-back",
            "evade-roll"
        ],
        "sword": [
            "evade-back",
            "evade-duck"
        ],
        "umbrella": [
            "evade-back",
            "evade-roll"
        ],
        "wand": [
            "evade-phase",
            "evade-duck"
        ]
    },
    "guard": {
        "axe": [
            "guard-slide"
        ],
        "blaster": [
            "guard-hex"
        ],
        "book": [
            "guard-hex"
        ],
        "bow": [
            "guard-slide"
        ],
        "dagger": [
            "guard-slide"
        ],
        "fan": [
            "guard-just"
        ],
        "guitar": [
            "guard-just"
        ],
        "hammer": [
            "guard-cross"
        ],
        "katana": [
            "guard-parry"
        ],
        "pan": [
            "guard-hex"
        ],
        "scythe": [
            "guard-just"
        ],
        "shield": [
            "guard-hex"
        ],
        "spear": [
            "guard-slide"
        ],
        "sword": [
            "guard-cross"
        ],
        "umbrella": [
            "guard-just"
        ],
        "wand": [
            "guard-hex"
        ]
    },
    "jump": {
        "axe": [
            "jump-charge"
        ],
        "blaster": [
            "jump-big"
        ],
        "book": [
            "jump-float"
        ],
        "bow": [
            "jump-flip"
        ],
        "dagger": [
            "jump-double"
        ],
        "fan": [
            "jump-rocket"
        ],
        "guitar": [
            "jump-float"
        ],
        "hammer": [
            "jump-charge"
        ],
        "katana": [
            "jump-rocket"
        ],
        "pan": [
            "jump-float"
        ],
        "scythe": [
            "jump-flip"
        ],
        "shield": [
            "jump-flip"
        ],
        "spear": [
            "jump-big"
        ],
        "sword": [
            "jump-big"
        ],
        "umbrella": [
            "jump-float"
        ],
        "wand": [
            "jump-float"
        ]
    },
    "magic": {
        "book": [
            "magic-thunder"
        ],
        "fan": [
            "magic-wind"
        ],
        "wand": [
            "magic-circle"
        ]
    },
    "ougi": {
        "axe": [
            "ougi-fall"
        ],
        "blaster": [
            "ougi-comet"
        ],
        "book": [
            "ougi-bolt"
        ],
        "bow": [
            "ougi-comet"
        ],
        "dagger": [
            "ougi-shadow"
        ],
        "fan": [
            "ougi-moon"
        ],
        "guitar": [
            "ougi-cross"
        ],
        "hammer": [
            "ougi-fall"
        ],
        "katana": [
            "ougi-cross"
        ],
        "pan": [
            "ougi-bolt"
        ],
        "scythe": [
            "ougi-moon"
        ],
        "shield": [
            "ougi-fall"
        ],
        "spear": [
            "ougi-fall"
        ],
        "sword": [
            "ougi-moon"
        ],
        "umbrella": [
            "ougi-comet"
        ],
        "wand": [
            "ougi-bolt"
        ]
    },
    "parry": {
        "axe": [
            "parry-behind"
        ],
        "blaster": [
            "parry-absorb"
        ],
        "book": [
            "parry-absorb"
        ],
        "bow": [
            "parry-catch"
        ],
        "dagger": [
            "parry-catch"
        ],
        "fan": [
            "parry-counter"
        ],
        "guitar": [
            "parry-catch"
        ],
        "hammer": [
            "parry-return"
        ],
        "katana": [
            "parry-counter"
        ],
        "pan": [
            "parry-return"
        ],
        "scythe": [
            "parry-behind"
        ],
        "shield": [
            "parry-mirror"
        ],
        "spear": [
            "parry-return"
        ],
        "sword": [
            "parry-return"
        ],
        "umbrella": [
            "parry-mirror"
        ],
        "wand": [
            "parry-catch"
        ]
    },
    "rush": {
        "axe": [
            "rush-cyclone"
        ],
        "blaster": [
            "rush-pierce"
        ],
        "book": [
            "rush-star"
        ],
        "bow": [
            "rush-pierce"
        ],
        "dagger": [
            "rush-hundred"
        ],
        "fan": [
            "rush-frames"
        ],
        "guitar": [
            "rush-hundred"
        ],
        "hammer": [
            "rush-cyclone"
        ],
        "katana": [
            "rush-frames"
        ],
        "pan": [
            "rush-pierce"
        ],
        "scythe": [
            "rush-cyclone"
        ],
        "shield": [
            "rush-cyclone"
        ],
        "spear": [
            "rush-pierce"
        ],
        "sword": [
            "rush-frames"
        ],
        "umbrella": [
            "rush-cyclone"
        ],
        "wand": [
            "rush-star"
        ]
    },
    "seal": {
        "axe": [
            "seal-freeze"
        ],
        "blaster": [
            "seal-box"
        ],
        "book": [
            "seal-freeze"
        ],
        "bow": [
            "seal-stakes"
        ],
        "dagger": [
            "seal-stakes"
        ],
        "fan": [
            "seal-talisman"
        ],
        "guitar": [
            "seal-pillar"
        ],
        "hammer": [
            "seal-box"
        ],
        "katana": [
            "seal-chains"
        ],
        "pan": [
            "seal-pillar"
        ],
        "scythe": [
            "seal-chains"
        ],
        "shield": [
            "seal-box"
        ],
        "spear": [
            "seal-box"
        ],
        "sword": [
            "seal-stakes"
        ],
        "umbrella": [
            "seal-pillar"
        ],
        "wand": [
            "seal-chains"
        ]
    },
    "shoot": {
        "blaster": [
            "shot-charge",
            "shot-spread"
        ],
        "bow": [
            "shot-burst"
        ]
    },
    "slash": {
        "dagger": [
            "slash-afterimage"
        ],
        "katana": [
            "slash-crescent",
            "slash-iai"
        ],
        "scythe": [
            "slash-heavy"
        ],
        "sword": [
            "slash-crescent"
        ]
    },
    "summon": {
        "axe": [
            "summon-fist"
        ],
        "blaster": [
            "summon-meteor"
        ],
        "book": [
            "summon-meteor"
        ],
        "bow": [
            "summon-bird"
        ],
        "dagger": [
            "summon-tornado"
        ],
        "fan": [
            "summon-knight"
        ],
        "guitar": [
            "summon-tornado"
        ],
        "hammer": [
            "summon-knight"
        ],
        "katana": [
            "summon-sword"
        ],
        "pan": [
            "summon-meteor"
        ],
        "scythe": [
            "summon-fist"
        ],
        "shield": [
            "summon-fist"
        ],
        "spear": [
            "summon-tornado"
        ],
        "sword": [
            "summon-sword"
        ],
        "umbrella": [
            "summon-bird"
        ],
        "wand": [
            "summon-fist"
        ]
    },
    "thrust": {
        "spear": [
            "thrust-sweep"
        ],
        "umbrella": [
            "thrust-dive"
        ]
    }
};
//# sourceMappingURL=motionpicks.js.map