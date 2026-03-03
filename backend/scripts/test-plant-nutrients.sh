#!/bin/bash

# Test plant nutrient deficiency system

API_URL="http://localhost:4000/api"
GAME_NAME="aquaponics"

echo "=== Plant Nutrient Deficiency Test ==="
echo ""

# Step 1: Create a new game
echo "Creating new game..."
MATCH_RESPONSE=$(curl -s -X POST "${API_URL}/games/${GAME_NAME}/create" \
  -H "Content-Type: application/json")

MATCH_ID=$(echo $MATCH_RESPONSE | jq -r '.matchID')
echo "Match ID: $MATCH_ID"
echo ""

# Step 2: Plant some lettuce
echo "Planting 3 Parris Island Romaine..."
PLANT_RESPONSE=$(curl -s -X POST "${API_URL}/games/${GAME_NAME}/${MATCH_ID}/move" \
  -H "Content-Type: application/json" \
  -d '{
    "playerID": "0",
    "move": "plantSeed",
    "args": ["ParrisIslandRomaine", 3]
  }')
echo "Plant response:"
echo $PLANT_RESPONSE | jq '.'
echo ""

# Step 3: Progress a few turns to see plant growth
echo "Progressing 4 turns to watch plant growth..."
for i in {1..4}; do
  echo ""
  echo "=== Turn $i ==="
  TURN_RESPONSE=$(curl -s -X POST "${API_URL}/games/${GAME_NAME}/${MATCH_ID}/move" \
    -H "Content-Type: application/json" \
    -d '{
      "playerID": "0",
      "move": "progressTurn"
    }')
  
  # Show plant status
  echo ""
  echo "Plant Status:"
  echo "$TURN_RESPONSE" | jq '.G.plants[] | {
    id,
    type,
    health,
    maturity,
    weeksGrown,
    deficiencies
  }'
  
  # Show water chemistry
  echo ""
  echo "Water Chemistry:"
  echo "$TURN_RESPONSE" | jq '.G.aquaponicsSystem.tank.water | {
    nitrate,
    phosphorus,
    potassium,
    calcium,
    magnesium,
    iron,
    pH
  }'
  
  sleep 1
done

echo ""
echo "=== Test Complete ==="
echo ""
echo "Expected observations:"
echo "- Plants should show growth each turn"
echo "- Nutrient levels should decrease as plants consume them"
echo "- Deficiency symptoms may appear if nutrients drop too low"
echo "- Growth rate should be reduced when deficiencies occur"
echo "- pH deviations from 6.5 should reduce growth"
