Done:


Make sure that inventory and money are updated after every move.

Add a button next to 'Progress Day' to 'Progress 3 Days' and make sure that game state progresses/ updates 3 times (for 3 days ), including events

Add a button in the front end water chemistry component for users to add buffering solutions and /or chelated iron from their inventory. Make sure the water state and inventory gets updated correctly.

Add logic so that if fish are not fed their health decreases; if not fed after 5 days, they will die.

There is still a bug: when there is a die off of fish or plants, they all disappear from the game and the 3D scene!

Let's inspect the Water Chemistry panel in the front end and make sure that the chart is updated every move and includes charting plant and fish deaths along with the water chemistry linegraphs



Let's add support for Aeration Stones to the Market and user Inventory (pack of 10 for $25). In the Water Chemistry panel, the user can add these (like the other buffering solutions) to fix the low-oxygen event or situation.

Let's similarly add support for a Biofilter to the Market and user Inventory ($120 each). In the Water Chemistry panel, the user can add these (like the other consumables) to fix high ammonia and nitrite events or situation.

In the front end, let's add a user 'Mute' button that disables game sound. Then, let's add the following mp3 sound clips (in the Frontend/public/audio/ folder) to play in the following situations:

1) for an event alert popup: floraphonic-8-bit-game-1-186975.mp3  

2) when the user feeds the fish:  pwlpl-power-up-game-sound-effect-359227.mp3

3) when the user harvests fish or plants: freesound_community-win-short-38508.mp3

4) when the user plays any consumable inventory (not fish food), use dammafra-virtual-pet-happy-458154.mp3

There is still some bug in the game play. Plant and fish stocks are sometimes wiped out of game state (and the 3D scene). The javascript .alert notification includes the text: 
'*losses: *' but give no explanation for the catastrophic wipeout. Check the backend game logic like to see what is happening for example, play routes involving /src/game/data/events.js.

- filterClog fix

Now let's add support for additional species of plants. We will add to:
backend/src/data/plantSpecies.js and update for the following species:

Rosemary : { renderAsset: 'plants/rosemary.glb'}

Basil : { renderAsset: 'plants/basil.glb'}

Tomato : { renderAsset: 'plants/green_tom.glb'}

Pepper : { renderAsset: 'plants/pepper1.glb'}


Update the repo README.md to summarize the game features of this codebase.
Now update the README.md to include specfic information about the Aquaponics simulation model,espoecially the different kinds of events players will be faced with and the different inventory they can buy to manage it.


Everytime the 'Progress 3 Days' button is pushed, there is some
catastrophic die off of plants.

Why does a Market day bonus delete all fish and plants in the game state?

Check all the play routes using events.js and moves in both 1 Day and 3 day turns.


The chart in Water Quality panel is broken and not drawing any data, even though several days have progressed.


The 'fix water leak' event causes a catastrophic die off.

Load game state


Let's add event notifications to the frontend notification panel so that the user has a chance to play a move before any event takes effect. Wait until the user presses the 'Progress Day' or the 'Progess 3 Days' button to evaluate the system state change.
 => pendingEvent added