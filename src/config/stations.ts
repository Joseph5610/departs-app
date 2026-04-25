export const LINE_COLORS = {
    A: '#00A562',
    B: '#F8B322',
    C: '#CF003D',
    Transfer: '#0f172a',
    Unknown: '#38bdf8',
    DefaultStation: '#1e3a8a',
    TrainStation: '#1c1745'
};

export const METRO_STATIONS: Record<string, string[]> = {
    // Line A (Green)
    "Nemocnice Motol": ["A"], "Petřiny": ["A"], "Nádraží Veleslavín": ["A"], "Bořislavka": ["A"],
    "Dejvická": ["A"], "Hradčanská": ["A"], "Malostranská": ["A"], "Staroměstská": ["A"],
    "Náměstí Míru": ["A"], "Jiřího z Poděbrad": ["A"], "Flora": ["A"], "Želivského": ["A"],
    "Strašnická": ["A"], "Skalka": ["A"], "Depo Hostivař": ["A"],

    // Line B (Yellow)
    "Zličín": ["B"], "Stodůlky": ["B"], "Luka": ["B"], "Lužiny": ["B"], "Hůrka": ["B"],
    "Nové Butovice": ["B"], "Jinonice": ["B"], "Radlická": ["B"], "Smíchovské nádraží": ["B"],
    "Anděl": ["B"], "Karlovo náměstí": ["B"], "Národní třída": ["B"], "Náměstí Republiky": ["B"],
    "Křižíkova": ["B"], "Invalidovna": ["B"], "Palmovka": ["B"], "Českomoravská": ["B"],
    "Vysočanská": ["B"], "Kolbenova": ["B"], "Hloubětín": ["B"], "Rajská zahrada": ["B"], "Černý Most": ["B"],

    // Line C (Red)
    "Letňany": ["C"], "Prosek": ["C"], "Střížkov": ["C"], "Ládví": ["C"], "Kobylisy": ["C"],
    "Nádraží Holešovice": ["C"], "Vltavská": ["C"], "Hlavní nádraží": ["C"], "I. P. Pavlova": ["C"],
    "Vyšehrad": ["C"], "Pražského povstání": ["C"], "Pankrác": ["C"], "Budějovická": ["C"],
    "Kačerov": ["C"], "Roztyly": ["C"], "Chodov": ["C"], "Opatov": ["C"], "Háje": ["C"],

    // Transfers
    "Můstek": ["A", "B"],
    "Muzeum": ["A", "C"],
    "Florenc": ["B", "C"]
};


// Generate the flat array for Mapbox 'match' expression: [name, color, name, color, ...]
export const getStationColorMatchPairs = (): (string | number)[] => {
    const pairs: (string | number)[] = [];

    // Explicit Transfers
    pairs.push('Můstek', LINE_COLORS.Transfer);
    pairs.push('Muzeum', LINE_COLORS.Transfer);
    pairs.push('Florenc', LINE_COLORS.Transfer);

    // All others
    Object.entries(METRO_STATIONS).forEach(([name, lines]) => {
        if (lines.length > 1) return; // Skip transfers already handled

        const line = lines[0];
        if (line === 'A') pairs.push(name, LINE_COLORS.A);
        if (line === 'B') pairs.push(name, LINE_COLORS.B);
        if (line === 'C') pairs.push(name, LINE_COLORS.C);
    });

    return pairs;
};
