// Sprite icon system — maps emoji icon strings to 1-bit pixel art PNGs
// Icons are white-on-transparent, rendered at native size with pixelated scaling

const SPRITE_DIR = 'assets/sprites/1-bit_Pixel_Icons/Sprites_Cropped/';

const ICON_MAP = {
  // ── OFFENSE ──
  '⚡':    'Weather_Thunderstorm_Cloud_Lightning_Zap.png',
  '◎':    'RPG_Stat_Accuracy_Ranged_Target.png',
  '↕':    'Arrows_Double_Vertical_Up_Down.png',
  '🎯':   'Warfare_Crosshair_Marked_Sniper_Headshot_Accuracy_1.png',
  '≫':    'Arrows_Media_Controls_Fast_Forward.png',
  '🔵':   'RPG_Item_Weapon_Bullet_Ammo_Ranged_Pierce_Damage.png',
  '💨':   'RPG_Skill_Dash_Dodge_Movement_Speed_Run_Sprint.png',
  '💥':   'Warfare_Explosion_Bomb.png',
  '↯':    'Arrows_Reload_Refresh_Rotate_Clockwise.png',
  '🌀':   'Weather_Tornado_Cyclone_Whirlwind_Natural_Disaster.png',
  '→':    'Arrows_Right_East.png',
  '⬇':    'Arrows_Down_South.png',
  '⏳':   'Software_Hourglass_Sand_Time_Wait.png',
  '◆':    'RPG_Gem_Jewelcrafting_Diamond_Points_Currency.png',
  '▣':    'RPG_Magic_Mana_Hearth_Stone.png',
  '🧲':   'RPG_Stat_Magnetism.png',
  '➶':    'RPG_Item_Weapon_Bow_Drawn_Ranged_Shooting.png',
  '🎯+':  'Warfare_Crosshair_Marked_Sniper_Headshot_Accuracy_2.png',

  // ── SURVIVAL ──
  '◉':    'RPG_Stat_HP_Health_Heart.png',
  '👻':   'RPG_Creature_Archetypes_Ghost_Specter_Poltergeist.png',
  '💚':   'RPG_Stat_HP_Health_Heart_Small.png',
  '🧱':   'Travel_Construction_Bricks_Wall.png',
  '🧱+':  'Travel_Construction_Bricks_Wall_Big_1.png',
  '⚕️':   'Alchemy_Life.png',
  '·':     'RPG_Skull_Death_Dead_Small.png',
  '⬢':    'RPG_Difficulty_5_Brutal_Monster_Demon_Boss_Skull_Shield.png',
  '🛡️':   'RPG_Item_Stat_Shield_Defense_Armor.png',
  '🛡️+':  'RPG_Difficulty_4_Hard_Knightly_Kite_Heater_Shield.png',
  '🪞':   'Cosmetics_Hand_Mirror_1.png',
  '💠':   'RPG_Spell_Skill_Magic_Arcane_Missiles_Multishot.png',
  '💠+':  'RPG_Spell_Skill_Magic_Explosive_Explosion.png',
  '⬡':    'RPG_Debuff_Stunned_Disabled_CC_Crowd_Control.png',
  '⚡🛡️': 'Software_Power_Electricity_Battery_Thunder_Lightning_Bolt_Zap.png',

  // ── ORB BOONS ──
  '🔮':   'RPG_Item_Weapon_Staff_Magic_Orb.png',
  '🔮+':  'RPG_Item_Weapon_Wand_Magic_Orb.png',
  '🔮↔':  'RPG_Magic_Crystal_Ball_Clairvoyance_Omnipotence.png',
  '⚡→':  'RPG_Spell_Skill_Magic_Chain_Lightning_Link.png',
  '⚡≫':  'RPG_Item_Weapon_Wand_Magic_Star_Damage.png',
  '⚡⬆':  'Alchemy_Potion_Vial_Bottle_Lightning_Bolt_Zap_Speed_Full.png',
  '🌐':   'Software_Planet_Geography_Localization_Global_Language_Translation_1.png',

  // ── ESCALATION / SYNERGY ──
  '🔋':   'Software_Battery_Power_Level_3_Full.png',
  '🔨':   'RPG_Item_Weapon_Hammer_Mace_Crushing_Damage.png',
  '◈':    'Boardgames_Suit_Diamonds.png',
  '↺':    'Arrows_Roundabout_Rotation_Circle_Reload_Refresh_Loop.png',
  '⋔':    'RPG_Skill_Multishot_Arrows_Ranged_Attack.png',
  '⋔+':   'RPG_Skill_Multishot_Arrows_Ranged_Attack.png',
  '💢':   'Warfare_Weapon_Hand_Grenade_Bomb_Shrapnel.png',
  '💢+':  'Warfare_Weapon_Hand_Grenade_Bomb_Shrapnel.png',
  '〜':   'Weather_Windy_Air_Element.png',
  '〜+':  'Weather_Windy_Air_Element.png',
  '≋+':   'Weather_Water_Droplet_Liquid_Rain_Element_Big.png',
  '⤥':    'RPG_Stat_Magnetism.png',
  '⬆':    'Arrows_Up_North.png',
  '⊙':    'Tools_Crafting_Graphic_Design_Shapes_Circle_Outlined.png',
  '⊙+':   'Tools_Crafting_Graphic_Design_Shapes_Circle_Filled.png',
  '◌':    'Tools_Crafting_Graphic_Design_Shapes_Circle.png',

  // ── BLOOD / VAMPIRIC ──
  '🩸':   'RPG_Skill_Teeth_Fangs_Bite_Beast_Vampire_Blood_Leech_Damage.png',
  '🩸+':  'RPG_Buff_Enraged_Anger_Bloodlust_Taunt.png',
  '🩸→':  'RPG_Skill_Killshot_Bow_Ranged_Attack_Skull.png',
  '🐺':   'RPG_Creature_Archetypes_Beast_Wolf_Howling.png',
  '♾':    'Alchemy_Infinity.png',
  '♾+':   'Alchemy_Infinity.png',
  '🔴':   'RPG_Buff_Enraged_Anger_Bloodlust_Taunt_Small.png',
  '☠':    'RPG_Skull_Death_Dead_Bones_Pirates.png',
  '💀':   'RPG_Creature_Archetypes_Undead_Skull_Death.png',
  '💀+':  'RPG_Creature_Archetypes_Undead_Skull_Death.png',

  // ── GROWTH / UTILITY ──
  '🌱':   'Weather_Flower_Spring_Season.png',
  '🍃':   'Weather_Nature_Leaf_Autumn_Fall_Element.png',
  '📈':   'Software_Statistics_Stats_Graphs_Growth.png',
  '⬄':    'Arrows_Double_Horizontal_Left_Right.png',
  '⬚':    'RPG_Buff_Blink_Teleport_Invisibility.png',
  '💣':   'RPG_Item_Bomb_Grenade_Explosive.png',
  '💣+':  'RPG_Skill_Explosive_Shot_Bomb_Arrow.png',
  '💡':   'RPG_Item_Weapon_Wand_Magic_Glow_Damage.png',

  // ── LEGENDARIES ──
  '🏛️':   'Map_Markers_Building_Bank_Greek_Temple.png',
  '🌊':   'Weather_Water_Sea_Ocean_Waves_Wavy.png',
  '☀️':   'Weather_Sun_Holy_Light_Rays_Summer_Season.png',

  // ── SPECIAL UI ──
  '🎲':   'Boardgames_Dice_Cube_D6_Six_Pips_Dots.png',

  // ── COLOR SCHEME ──
  '🟢':   'Tools_Crafting_Graphic_Design_Shapes_Circle_Filled.png',
  '🔵c':  'Tools_Crafting_Graphic_Design_Shapes_Circle_Filled.png',
  '🟣':   'Tools_Crafting_Graphic_Design_Shapes_Circle_Filled.png',
  '💗':   'Tools_Crafting_Graphic_Design_Shapes_Circle_Filled.png',
  '⭐':   'RPG_Stat_Luck_Four_Leaf_Clover.png',
  '🔴c':  'Tools_Crafting_Graphic_Design_Shapes_Circle_Filled.png',
  '🧊':   'Tools_Crafting_Graphic_Design_Shapes_Circle_Filled.png',
  '🔥':   'Tools_Crafting_Graphic_Design_Shapes_Circle_Filled.png',
};

/**
 * Returns an <img> HTML string for a given icon key (emoji string).
 * Falls back to the raw emoji text if no sprite mapping exists.
 */
function iconHTML(icon, cssClass = 'up-icon') {
  const file = ICON_MAP[icon];
  if (file) {
    return `<div class="${cssClass}"><img src="${SPRITE_DIR}${file}" alt="" draggable="false"></div>`;
  }
  return `<div class="${cssClass}">${icon}</div>`;
}

/**
 * Returns just the <img> tag (no wrapper) for inline use.
 */
function iconImg(icon) {
  const file = ICON_MAP[icon];
  if (file) {
    return `<img class="sprite-icon" src="${SPRITE_DIR}${file}" alt="" draggable="false">`;
  }
  return icon;
}

export { ICON_MAP, SPRITE_DIR, iconHTML, iconImg };
