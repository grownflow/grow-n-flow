#!/bin/bash

BASE_URL="http://localhost:4000/api/games/aquaponics"

echo "Testing Aquaponics API..."
echo ""

# Create match
echo "1. Creating match..."
RESPONSE=$(curl -s -X POST "$BASE_URL/create" \
  -H 'Content-Type: application/json' \
  -d '{}')

echo "Response: $RESPONSE"

# Extract matchID (works without jq)
MATCH_ID=$(echo "$RESPONSE" | grep -o '"matchID":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MATCH_ID" ]; then
  echo "ERROR: Failed to create match"
  exit 1
fi

echo "SUCCESS: Match created: $MATCH_ID"
echo ""

# Add fish
echo "2. Adding fish..."
curl -s -X POST "$BASE_URL/$MATCH_ID/move" \
  -H 'Content-Type: application/json' \
  -d '{"move":"addFish","args":["tilapia",5],"playerID":"0"}' | head -c 100
echo "..."
echo ""

# Feed fish
echo "4. Feeding fish..."
curl -s -X POST "$BASE_URL/$MATCH_ID/move" \
  -H 'Content-Type: application/json' \
  -d '{"move":"feedFish","args":[0,10],"playerID":"0"}' | head -c 100
echo "..."
echo ""

# Progress turn
echo "5. Progressing turn..."
curl -s -X POST "$BASE_URL/$MATCH_ID/move" \
  -H 'Content-Type: application/json' \
  -d '{"move":"progressTurn","args":[],"playerID":"0"}' | head -c 100
echo "..."
echo ""

# Get final state
echo "6. Getting final state..."
STATE=$(curl -s "$BASE_URL/$MATCH_ID")
echo "$STATE"
echo "..."
echo ""

# Extract gameTime to verify
GAME_TIME=$(echo "$STATE" | grep -o '"gameTime":[0-9]*' | cut -d':' -f2)
echo "SUCCESS: Test complete. Game time: $GAME_TIME"
echo "Match ID: $MATCH_ID"