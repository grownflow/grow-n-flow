#!/bin/bash

# Test script for events system
# Creates a match and progresses turns to see events trigger

echo "🎮 Testing Events System"
echo "========================"
echo ""

# Create a match
echo "Creating match..."
RESPONSE=$(curl -s -X POST http://localhost:4000/api/games/aquaponics/create \
  -H "Content-Type: application/json" \
  -d '{}')

MATCH_ID=$(echo $RESPONSE | jq -r '.matchID')

if [ -z "$MATCH_ID" ] || [ "$MATCH_ID" = "null" ]; then
  echo "❌ Failed to create match"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ Match created: $MATCH_ID"
echo ""

# Progress through 10 turns to see events trigger
for i in {1..10}; do
  echo "=== Turn $i ==="
  
  TURN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/games/aquaponics/$MATCH_ID/move \
    -H "Content-Type: application/json" \
    -d '{"move":"progressTurn","args":[],"playerID":"0"}')
  
  # Check if event triggered
  EVENT_TRIGGERED=$(echo $TURN_RESPONSE | jq -r '.G.lastAction.eventTriggered')
  
  if [ "$EVENT_TRIGGERED" = "true" ]; then
    EVENT_NAME=$(echo $TURN_RESPONSE | jq -r '.G.lastAction.event.name')
    EVENT_DESC=$(echo $TURN_RESPONSE | jq -r '.G.lastAction.event.description')
    TURNS_REMAINING=$(echo $TURN_RESPONSE | jq -r '.G.lastAction.event.turnsRemaining')
    
    echo "🎉 EVENT TRIGGERED!"
    echo "   Name: $EVENT_NAME"
    echo "   Description: $EVENT_DESC"
    echo "   Event Turns Remaining: $TURNS_REMAINING"
  else
    echo "   No event triggered"
  fi
  
  # Show active event effects if any
  ACTIVE_EVENT=$(echo $TURN_RESPONSE | jq -r '.G.activeEvent.name // empty')
  if [ ! -z "$ACTIVE_EVENT" ]; then
    echo "   📌 Active: $ACTIVE_EVENT"
  fi
  
  echo ""
done

echo "✅ Test complete!"
