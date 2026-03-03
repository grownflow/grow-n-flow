#!/bin/bash

BASE_URL="http://localhost:4000/api/games/aquaponics"
CLEANUP=${CLEANUP:-true}

echo "End-to-End Aquaponics Test"
echo ""

# 1. Create match
echo "1. Creating match..."
RESPONSE=$(curl -s -X POST "$BASE_URL/create" \
  -H 'Content-Type: application/json' \
  -d '{}')

MATCH_ID=$(echo "$RESPONSE" | grep -o '"matchID":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MATCH_ID" ]; then
  echo "ERROR: Failed to create match"
  exit 1
fi

echo "Match ID: $MATCH_ID"
echo ""

# 2. Add fish
echo "2. Adding tilapia (5 count)..."
curl -s -X POST "$BASE_URL/$MATCH_ID/move" \
  -H 'Content-Type: application/json' \
  -d '{"move":"addFish","args":["tilapia",5],"playerID":"0"}' > /dev/null
echo "Added"
echo ""

# 3. Plant seeds
echo "3. Planting ParrisIslandRomaine..."
curl -s -X POST "$BASE_URL/$MATCH_ID/move" \
  -H 'Content-Type: application/json' \
  -d '{"move":"plantSeed","args":["ParrisIslandRomaine","bed1"],"playerID":"0"}' > /dev/null
echo "Planted"
echo ""

# 4. Feed fish
echo "4. Feeding fish (10 units)..."
curl -s -X POST "$BASE_URL/$MATCH_ID/move" \
  -H 'Content-Type: application/json' \
  -d '{"move":"feedFish","args":[0,10],"playerID":"0"}' > /dev/null
echo "Fed"
echo ""

# 5. Progress days
echo "5. Progressing 5 days..."
for day in {1..5}; do
  curl -s -X POST "$BASE_URL/$MATCH_ID/move" \
    -H 'Content-Type: application/json' \
    -d '{"move":"progressTurn","args":[],"playerID":"0"}' > /dev/null
  echo "Day $day complete"
done
echo ""

# 6. Get state
echo "6. Final game state:"
STATE=$(curl -s "$BASE_URL/$MATCH_ID")
echo "$STATE" | head -c 300
echo "..."
echo ""

# Extract metrics
GAME_TIME=$(echo "$STATE" | grep -o '"gameTime":[0-9]*' | cut -d':' -f2)
MONEY=$(echo "$STATE" | grep -o '"money":[0-9]*' | cut -d':' -f2)
FISH_COUNT=$(echo "$STATE" | grep -o '"fish":\[' | wc -l)
PLANT_COUNT=$(echo "$STATE" | grep -o '"plants":\[' | wc -l)

echo "Results:"
echo "  Game Time: $GAME_TIME days"
echo "  Money: \$$MONEY"
echo ""

# 7. Cleanup
if [ "$CLEANUP" = "true" ]; then
  echo "7. Cleaning up..."
  mongosh aquaponics_dev --quiet --eval "db.matches.deleteOne({matchID: '$MATCH_ID'})"
  echo "Match deleted"
else
  echo "Match preserved: $MATCH_ID"
fi