#!/usr/bin/env python3
"""Analyze matches from a redacted JSON export.

Usage:
    python3 analyze-matches.py <redacted_json_file>
    python3 analyze-matches.py /tmp/gnf-dumps/aquaponics_dev_..._redacted.json
"""
import json
import sys


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 analyze-matches.py <redacted_json_file>", file=sys.stderr)
        sys.exit(1)

    lines = open(sys.argv[1]).readlines()
    data = None
    for i, line in enumerate(lines):
        if line.strip() == '=== REDACTED DATA ===':
            data = json.loads(''.join(lines[i + 1:]))
            break

    if data is None:
        # Try parsing as plain JSON
        data = json.loads(''.join(lines))

    for m in data.get('matches', []):
        g = m.get('G', {})
        fish = g.get('fish', [])
        plants = g.get('plants', [])
        money = g.get('money', 0)
        game_time = g.get('gameTime', 0)
        eq = g.get('equipment', {})
        inv = g.get('inventory', {}).get('produce', {})
        bills = g.get('billsAccrued', {})
        alerts = g.get('systemAlerts', [])
        event = g.get('activeEvent')
        event_hist = g.get('eventHistory', [])
        sys_data = g.get('aquaponicsSystem', {})
        tank = sys_data.get('tank', {})
        water = tank.get('water', {})
        light = sys_data.get('light', {})
        ctx = m.get('ctx', {})

        # Fish summary
        fish_types = {}
        for f in fish:
            t = f.get('type', '?')
            fish_types[t] = fish_types.get(t, 0) + 1
        fish_health_avg = sum(f.get('health', 0) for f in fish) / len(fish) if fish else 0
        fish_weight_avg = sum(f.get('weight', 0) for f in fish) / len(fish) if fish else 0
        starving = [f for f in fish if f.get('daysWithoutFood', 0) >= 2]

        # Plant summary
        plant_stages = {}
        plant_types = {}
        for p in plants:
            stage = p.get('growthStage', '?')
            plant_stages[stage] = plant_stages.get(stage, 0) + 1
            t = p.get('type', '?')
            plant_types[t] = plant_types.get(t, 0) + 1
        plant_health_avg = sum(p.get('health', 0) for p in plants) / len(plants) if plants else 0

        beds = sys_data.get('growBeds', [])
        beds_count = len(beds) if isinstance(beds, list) else 0

        print("=" * 80)
        print("Match: {}  |  Status: {}  |  Turn: {}  |  GameTime: {}".format(
            m['matchID'], m['status'], ctx.get('turn', 0), game_time))
        print("  Owner: {}  |  Players: {}".format(
            m.get('ownerUserId', '?')[:12], len(m.get('players', []))))
        print("  Money: ${:.2f}  |  Bills: elec=${:.2f} water=${:.2f}".format(
            money, bills.get('electricity', 0), bills.get('water', 0)))
        print()

        if fish:
            print("  FISH ({} total):  {}".format(len(fish), dict(fish_types)))
            print("    Avg health: {:.1f}/10  |  Avg weight: {:.1f}g  |  Starving (2+ days): {}".format(
                fish_health_avg, fish_weight_avg, len(starving)))
            for f in fish:
                print("    - {} id={} hp={:.1f} wt={:.1f}g age={} daysNoFood={}".format(
                    f.get('type', '?'), f.get('id', '?')[:15], f.get('health', 0),
                    f.get('weight', 0), f.get('age', 0), f.get('daysWithoutFood', 0)))
        else:
            print("  FISH: none")

        print()

        if plants:
            print("  PLANTS ({} total):  {}".format(len(plants), dict(plant_types)))
            print("    Stages: {}  |  Avg health: {:.1f}/10".format(dict(plant_stages), plant_health_avg))
        else:
            print("  PLANTS: none")

        print()
        print("  WATER: NH3={:.3f} NO2={:.3f} NO3={:.3f} pH={:.1f} temp={:.1f}C DO={:.1f} P={:.2f} K={:.2f}".format(
            water.get('ammonia', 0), water.get('nitrite', 0), water.get('nitrate', 0),
            water.get('pH', 0), water.get('temperature', 0), water.get('dissolvedOxygen', 0),
            water.get('phosphorus', 0), water.get('potassium', 0)))
        print("  TANK: {:.0f}L  |  Food in tank: {:.1f}  |  Sediment: {:.2f}  |  Biofilter: {:.0f}%".format(
            tank.get('volumeLiters', 0), tank.get('foodInTank', 0),
            tank.get('sediment', 0), tank.get('biofilterEfficiency', 0) * 100))
        print("  LIGHT: {}  {}h/day  |  Grow beds: {}".format(
            "ON" if light.get('isOn') else "OFF", light.get('hoursPerDay', 0), beds_count))

        print()
        print("  EQUIPMENT: {}".format(dict(eq)))
        print("  INVENTORY: {}".format(dict(inv) if inv else "empty"))

        if event:
            print("  ACTIVE EVENT: {} ({}) - {} turns left - {}".format(
                event.get('name', '?'), event.get('severity', '?'),
                event.get('turnsRemaining', 0), event.get('description', '')))
        print("  EVENT HISTORY: {} events".format(len(event_hist)))

        # Last action summary
        la = g.get('lastAction', {})
        if la:
            print("  LAST ACTION: {}  success={}".format(la.get('type', '?'), la.get('success', '?')))
            if la.get('fishDeaths'):
                print("    Fish deaths: {}".format(la['fishDeaths']))
            if la.get('plantDeaths'):
                print("    Plant deaths: {}".format(la['plantDeaths']))

        print()


if __name__ == '__main__':
    main()
