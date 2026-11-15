/** Catálogo de ediciones y Pokémon exclusivos por versión.
 * Las listas son de especies (no de formas regionales). La Pokédex regional
 * siempre se conserva; las especies exclusivas se añaden si todavía no están.
 * No se filtra la Pokédex regional mediante game_indices.
 */
export type PokedexGameOption = {
  key: string;
  label: string;
  exclusiveSpecies: readonly string[];
  pairKey?: string;
};

const GAME_CATALOG: Record<string, readonly PokedexGameOption[]> = {
  kanto: [
    {
      key: 'red', pairKey: 'blue', label: 'Pokémon Rojo',
      exclusiveSpecies: ['ekans','arbok','oddish','gloom','vileplume','mankey','primeape','growlithe','arcanine','scyther','electabuzz']
    },
    {
      key: 'blue', pairKey: 'red', label: 'Pokémon Azul',
      exclusiveSpecies: ['sandshrew','sandslash','vulpix','ninetales','meowth','persian','bellsprout','weepinbell','victreebel','magmar','pinsir']
    },
    { key: 'yellow', label: 'Pokémon Amarillo', exclusiveSpecies: [] },
    {
      key: 'firered', pairKey: 'leafgreen', label: 'Pokémon Rojo Fuego',
      exclusiveSpecies: ['ekans','arbok','oddish','gloom','vileplume','bellossom','psyduck','golduck','growlithe','arcanine','shellder','cloyster','electabuzz','elekid','scyther','scizor','wooper','quagsire','murkrow','qwilfish','delibird','skarmory']
    },
    {
      key: 'leafgreen', pairKey: 'firered', label: 'Pokémon Verde Hoja',
      exclusiveSpecies: ['sandshrew','sandslash','vulpix','ninetales','bellsprout','weepinbell','victreebel','slowpoke','slowbro','slowking','staryu','starmie','magmar','magby','pinsir','azurill','marill','azumarill','misdreavus','sneasel','remoraid','octillery','mantine']
    },
    {
      key: 'lets-go-pikachu', pairKey: 'lets-go-eevee', label: 'Pokémon: Let’s Go, Pikachu!',
      exclusiveSpecies: ['sandshrew','sandslash','oddish','gloom','vileplume','mankey','primeape','growlithe','grimer','muk','scyther']
    },
    {
      key: 'lets-go-eevee', pairKey: 'lets-go-pikachu', label: 'Pokémon: Let’s Go, Eevee!',
      exclusiveSpecies: ['ekans','arbok','vulpix','ninetales','meowth','persian','bellsprout','weepinbell','victreebel','koffing','weezing','pinsir']
    }
  ],
  'original-johto': [
    {
      key: 'gold', pairKey: 'silver', label: 'Pokémon Oro',
      exclusiveSpecies: ['mankey','primeape','growlithe','arcanine','spinarak','ariados','gligar','teddiursa','ursaring','mantine']
    },
    {
      key: 'silver', pairKey: 'gold', label: 'Pokémon Plata',
      exclusiveSpecies: ['vulpix','ninetales','meowth','persian','ledyba','ledian','delibird','skarmory','phanpy','donphan']
    },
    { key: 'crystal', label: 'Pokémon Cristal', exclusiveSpecies: [] },
    {
      key: 'heartgold', pairKey: 'soulsilver', label: 'Pokémon Oro HeartGold',
      exclusiveSpecies: ['mankey','primeape','growlithe','arcanine','omanyte','omastar','spinarak','ariados','gligar','mantine','phanpy','donphan','sableye','baltoy','claydol','anorith','armaldo','latias','kyogre','mantyke','gliscor']
    },
    {
      key: 'soulsilver', pairKey: 'heartgold', label: 'Pokémon Plata SoulSilver',
      exclusiveSpecies: ['vulpix','ninetales','meowth','persian','kabuto','kabutops','ledyba','ledian','teddiursa','ursaring','delibird','skarmory','mawile','gulpin','swalot','lileep','cradily','latios','groudon']
    }
  ],
  hoenn: [
    {
      key: 'ruby', pairKey: 'sapphire', label: 'Pokémon Rubí',
      exclusiveSpecies: ['seedot','nuzleaf','shiftry','mawile','zangoose','solrock','latios','groudon']
    },
    {
      key: 'sapphire', pairKey: 'ruby', label: 'Pokémon Zafiro',
      exclusiveSpecies: ['lotad','lombre','ludicolo','sableye','seviper','lunatone','latias','kyogre']
    },
    { key: 'emerald', label: 'Pokémon Esmeralda', exclusiveSpecies: [] },
    {
      key: 'omega-ruby', pairKey: 'alpha-sapphire', label: 'Pokémon Rubí Omega',
      exclusiveSpecies: ['kabuto','kabutops','ho-oh','seedot','nuzleaf','shiftry','mawile','zangoose','solrock','latios','groudon','shieldon','bastiodon','palkia','throh','archen','archeops','skrelp','dragalge']
    },
    {
      key: 'alpha-sapphire', pairKey: 'omega-ruby', label: 'Pokémon Zafiro Alfa',
      exclusiveSpecies: ['omanyte','omastar','lugia','lotad','lombre','ludicolo','sableye','seviper','lunatone','latias','kyogre','cranidos','rampardos','dialga','sawk','tirtouga','carracosta','clauncher','clawitzer']
    }
  ],
  sinnoh: [
    {
      key: 'diamond', pairKey: 'pearl', label: 'Pokémon Diamante',
      exclusiveSpecies: ['seel','dewgong','scyther','murkrow','larvitar','pupitar','tyranitar','poochyena','mightyena','aron','lairon','aggron','kecleon','cranidos','rampardos','honchkrow','stunky','skuntank','dialga']
    },
    {
      key: 'pearl', pairKey: 'diamond', label: 'Pokémon Perla',
      exclusiveSpecies: ['slowpoke','slowbro','pinsir','misdreavus','houndour','houndoom','stantler','spheal','sealeo','walrein','bagon','shelgon','salamence','shieldon','bastiodon','mismagius','glameow','purugly','palkia']
    },
    { key: 'platinum', label: 'Pokémon Platino', exclusiveSpecies: [] },
    {
      key: 'brilliant-diamond', pairKey: 'shining-pearl', label: 'Pokémon Diamante Brillante',
      exclusiveSpecies: ['caterpie','metapod','butterfree','ekans','arbok','growlithe','arcanine','seel','dewgong','scyther','scizor','electabuzz','electivire','murkrow','honchkrow','gligar','gliscor','elekid','raikou','entei','suicune','larvitar','pupitar','tyranitar','ho-oh','seedot','nuzleaf','shiftry','mawile','zangoose','solrock','kecleon','cranidos','rampardos','stunky','skuntank','dialga']
    },
    {
      key: 'shining-pearl', pairKey: 'brilliant-diamond', label: 'Pokémon Perla Reluciente',
      exclusiveSpecies: ['weedle','kakuna','beedrill','sandshrew','sandslash','vulpix','ninetales','slowpoke','slowbro','magmar','magmortar','pinsir','misdreavus','mismagius','teddiursa','ursaring','magby','lugia','lotad','lombre','ludicolo','sableye','seviper','lunatone','bagon','shelgon','salamence','shieldon','bastiodon','glameow','purugly','palkia']
    }
  ],
  unova: [
    {
      key: 'black', pairKey: 'white', label: 'Pokémon Negro',
      exclusiveSpecies: ['weedle','kakuna','beedrill','murkrow','honchkrow','houndour','houndoom','shroomish','breloom','plusle','gothita','gothorita','gothitelle','vullaby','mandibuzz','tornadus','reshiram']
    },
    {
      key: 'white', pairKey: 'black', label: 'Pokémon Blanco',
      exclusiveSpecies: ['caterpie','metapod','butterfree','paras','parasect','misdreavus','mismagius','poochyena','mightyena','minun','solosis','duosion','reuniclus','rufflet','braviary','thundurus','zekrom']
    },
    {
      key: 'black-2', pairKey: 'white-2', label: 'Pokémon Negro 2',
      exclusiveSpecies: ['weedle','kakuna','beedrill','magmar','magmortar','spinarak','ariados','sudowoodo','magby','plusle','spoink','grumpig','registeel','latios','buneary','lopunny','stunky','skuntank','bonsly','gible','gabite','garchomp','gothita','gothorita','gothitelle','vullaby','mandibuzz','zekrom']
    },
    {
      key: 'white-2', pairKey: 'black-2', label: 'Pokémon Blanco 2',
      exclusiveSpecies: ['caterpie','metapod','butterfree','mr-mime','electabuzz','electivire','ledyba','ledian','elekid','skitty','delcatty','minun','numel','camerupt','regice','latias','glameow','purugly','mime-jr','solosis','duosion','reuniclus','rufflet','braviary','reshiram']
    }
  ],
  kalos: [
    {
      key: 'x', pairKey: 'y', label: 'Pokémon X',
      exclusiveSpecies: ['swirlix','slurpuff','clauncher','clawitzer','xerneas','staryu','starmie','pinsir','houndour','houndoom','poochyena','mightyena','aron','lairon','aggron','lileep','cradily','anorith','armaldo','sawk']
    },
    {
      key: 'y', pairKey: 'x', label: 'Pokémon Y',
      exclusiveSpecies: ['spritzee','aromatisse','skrelp','dragalge','yveltal','shellder','cloyster','omanyte','omastar','kabuto','kabutops','heracross','larvitar','pupitar','tyranitar','electrike','manectric','purrloin','liepard','throh']
    }
  ],
  'original-alola': [
    {
      key: 'sun', pairKey: 'moon', label: 'Pokémon Sol',
      exclusiveSpecies: ['vulpix','ninetales','cranidos','rampardos','cottonee','whimsicott','tirtouga','carracosta','rufflet','braviary','passimian','turtonator','solgaleo','buzzwole','kartana']
    },
    {
      key: 'moon', pairKey: 'sun', label: 'Pokémon Luna',
      exclusiveSpecies: ['sandshrew','sandslash','shieldon','bastiodon','petilil','lilligant','archen','archeops','vullaby','mandibuzz','oranguru','drampa','lunala','pheromosa','celesteela']
    },
    {
      key: 'ultra-sun', pairKey: 'ultra-moon', label: 'Pokémon Ultrasol',
      exclusiveSpecies: ['vulpix','ninetales','houndour','houndoom','raikou','ho-oh','latios','groudon','dialga','heatran','cottonee','whimsicott','golett','golurk','rufflet','braviary','tornadus','reshiram','clauncher','clawitzer','xerneas','passimian','turtonator','solgaleo','buzzwole','kartana','blacephalon']
    },
    {
      key: 'ultra-moon', pairKey: 'ultra-sun', label: 'Pokémon Ultraluna',
      exclusiveSpecies: ['sandshrew','sandslash','entei','lugia','electrike','manectric','baltoy','claydol','latias','kyogre','palkia','regigigas','petilil','lilligant','vullaby','mandibuzz','thundurus','zekrom','skrelp','dragalge','yveltal','oranguru','drampa','lunala','pheromosa','celesteela','stakataka']
    }
  ],
  galar: [
    {
      key: 'sword', pairKey: 'shield', label: 'Pokémon Espada',
      exclusiveSpecies: ['farfetchd','pinsir','omanyte','omastar','ho-oh','seedot','nuzleaf','shiftry','mawile','solrock','bagon','shelgon','salamence','latios','groudon','dialga','tornadus','reshiram','xerneas','scraggy','scrafty','gothita','gothorita','gothitelle','rufflet','braviary','deino','zweilous','hydreigon','swirlix','slurpuff','turtonator','jangmo-o','hakamo-o','kommo-o','flapple','stonjourner','zacian','clauncher','clawitzer']
    },
    {
      key: 'shield', pairKey: 'sword', label: 'Pokémon Escudo',
      exclusiveSpecies: ['ponyta','rapidash','corsola','kabuto','kabutops','heracross','larvitar','pupitar','tyranitar','lotad','lombre','ludicolo','sableye','lunatone','croagunk','toxicroak','solosis','duosion','reuniclus','vullaby','mandibuzz','spritzee','aromatisse','goomy','sliggoo','goodra','drampa','appletun','cursola','eiscue','zamazenta','skrelp','dragalge','lugia','latias','kyogre','gible','gabite','garchomp','palkia','thundurus','zekrom','yveltal','lunala']
    }
  ],
  hisui: [
    { key: 'legends-arceus', label: 'Leyendas Pokémon: Arceus', exclusiveSpecies: [] }
  ],
  paldea: [
    {
      key: 'scarlet', pairKey: 'violet', label: 'Pokémon Escarlata',
      exclusiveSpecies: ['larvitar','pupitar','tyranitar','drifloon','drifblim','stunky','skuntank','deino','zweilous','hydreigon','skrelp','dragalge','oranguru','stonjourner','armarouge','great-tusk','scream-tail','brute-bonnet','flutter-mane','slither-wing','sandy-shocks','roaring-moon','koraidon','gligar','gliscor','cramorant','cranidos','rampardos','raikou','entei','suicune','ho-oh','latios','groudon','reshiram','solgaleo','glastrier','gouging-fire','raging-bolt']
    },
    {
      key: 'violet', pairKey: 'scarlet', label: 'Pokémon Púrpura',
      exclusiveSpecies: ['misdreavus','mismagius','bagon','shelgon','salamence','clauncher','clawitzer','passimian','eiscue','dreepy','drakloak','dragapult','ceruledge','iron-treads','iron-bundle','iron-hands','iron-jugulis','iron-moth','iron-thorns','iron-valiant','miraidon','aipom','ambipom','morpeko','shieldon','bastiodon','cobalion','terrakion','virizion','lugia','latias','kyogre','zekrom','lunala','spectrier','iron-boulder','iron-crown']
    }
  ]
};

export function getPokedexGames(regionKey: string): readonly PokedexGameOption[] {
  return GAME_CATALOG[regionKey] ?? [];
}

function normalizeGameName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const GAME_ALIASES: Record<string, readonly string[]> = {
  firered: ['fire red', 'rojo fuego'],
  'lets-go-pikachu': ['lets go pikachu', 'let s go pikachu'],
  'lets-go-eevee': ['lets go eevee', 'let s go eevee'],
  leafgreen: ['leaf green', 'verde hoja'],
  heartgold: ['heart gold', 'oro heartgold', 'oro corazón'],
  soulsilver: ['soul silver', 'plata soulsilver'],
  'omega-ruby': ['omega ruby', 'rubi omega'],
  'alpha-sapphire': ['alpha sapphire', 'zafiro alfa'],
  'brilliant-diamond': ['brilliant diamond', 'diamante brillante'],
  'shining-pearl': ['shining pearl', 'perla reluciente'],
  'black-2': ['black 2', 'negro 2'],
  'white-2': ['white 2', 'blanco 2'],
  'ultra-sun': ['ultra sun', 'ultrasol'],
  'ultra-moon': ['ultra moon', 'ultraluna'],
  'legends-arceus': ['legends arceus', 'leyendas arceus']
};

/** Sugiere la edición a partir del nombre del juego. Devuelve '' si no coincide. */
export function suggestPokedexGameKey(
  gameName: string,
  versionLabel: string,
  regionKey: string
): string {
  const haystack = ` ${normalizeGameName(`${gameName} ${versionLabel}`)} `;

  const candidates = getPokedexGames(regionKey)
    .flatMap((game) => {
      const shortLabel = game.label.replace(/^Pokémon\s+/i, '');
      return [game.key.replace(/-/g, ' '), game.label, shortLabel, ...(GAME_ALIASES[game.key] ?? [])]
        .map((candidate) => ({ key: game.key, normalized: normalizeGameName(candidate) }))
        .filter((candidate) => candidate.normalized !== '');
    })
    .sort((a, b) => b.normalized.length - a.normalized.length);

  return candidates.find(({ normalized }) => haystack.includes(` ${normalized} `))?.key ?? '';
}

export function getGameExclusiveSpecies(gameKey: string): readonly string[] {
  for (const games of Object.values(GAME_CATALOG)) {
    const match = games.find((game) => game.key === gameKey);
    if (match) return match.exclusiveSpecies;
  }
  return [];
}

/** Devuelve true cuando una especie del dex regional solo pertenece a la edición pareja. */
export function isExclusiveToOtherGame(gameKey: string, speciesKey: string): boolean {
  if (!gameKey || !speciesKey) return false;
  const current = Object.values(GAME_CATALOG).flat().find((game) => game.key === gameKey);
  if (!current?.pairKey) return false;
  const species = speciesKey.trim().toLowerCase();
  if (current.exclusiveSpecies.includes(species)) return false;
  const paired = Object.values(GAME_CATALOG).flat().find((game) => game.key === current.pairKey);
  return paired?.exclusiveSpecies.includes(species) ?? false;
}

export type PokedexEntryLike = { entryNumber: number; speciesKey: string; speciesUrl: string };

/** Une la Pokédex regional con los exclusivos de la edición, sin duplicados. */
export function appendGameExclusiveEntries<T extends PokedexEntryLike>(
  regionalEntries: readonly T[],
  gameKey: string,
  apiBase = 'https://pokeapi.co/api/v2'
): { entries: T[]; added: number } {
  const entries = [...regionalEntries];
  const known = new Set(entries.map((entry) => entry.speciesKey.trim().toLowerCase()));
  let nextNumber = entries.reduce((max, entry) => Math.max(max, entry.entryNumber), 0);
  let added = 0;

  for (const speciesKey of getGameExclusiveSpecies(gameKey)) {
    const normalized = speciesKey.trim().toLowerCase();
    if (!normalized || known.has(normalized)) continue;
    known.add(normalized);
    nextNumber += 1;
    entries.push({
      entryNumber: nextNumber,
      speciesKey: normalized,
      speciesUrl: `${apiBase}/pokemon-species/${encodeURIComponent(normalized)}/`
    } as T);
    added += 1;
  }

  return { entries, added };
}
