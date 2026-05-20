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

 Now make sure that on average, average players can get to at least one harvest of plants and fish with the available events and moves.
=> adjusted factors

 Had a lettuce plant die on Day 11 - now when I look at the system image, I see zero plants (whereas before was completely full).


Make sure the same data and rendering safe structure is applied to fish



 Day 13 and have a filter clog - not sure how to address the problem? 

 My ammonia and nitrite keep sneaking up and there is a recommendation to buy a bio filter - I think at this point I’ve purchased like 5 and am at Day 10. It may not be realistic to keep purchasing biofilters - can additional recommendations be added like reducing fish feed and/or fish biomass? Also, check about making the bioFilter last longer / be more effective

 my nitrate levels never seem to increase; check the mechanism logic and propose a fix
 => executed

 Update the READMEs with this information.

 Now let's add sound effects when the user clicks:  
 
 1) 'Progess Day' button -  use \FlowFarmFrontend\public\audio\universfield-video-game-bonus-323603.mp3

 and
 2) 'Progess 3 Days' button - use \FlowFarmFrontend\public\audio\ribhavagrawal-achievement-video-game-type-1-230515.mp3

 In the Front end, 
 
 1) update the style of the left hand panel (viewpoint control) so that it has 10px of padding outside the longest viewpoint text span
 and
 2) make the background of that Viewpoints component semi-transparent

 Now let's also make the front end UI more accessible and usable. Specifically, move the notification section (e.g. 'Fish died:' with black background) to the left so that the user can see the close button, even when the right hand panel is open (for example water chem component).

We need to inspect and correct the logic updating the the growing beds data structure.
After a plant disease outbreak at day 49 kills most rosemary, all plants are removed from the gamme state. Make sure that  the growing beds slots available can be counted and replanted correctly throughout the game.




 Now let's adjust the system and object parameters to make sure that on average, average players can achieve at least one harvest of plants and fish with only seven required moves (given the currently available events (and probabilities) and valid player moves). Update the READMEs with accurate info.
=>  All changes are done. Here's a summary of what was changed and why:

fishSpecies.js — Harvest times compressed further so a first fish harvest is achievable on the 7-move path:

Tilapia: 30 → 6 days (baseGrowthRate 19.7 → 98.3 g/day) — reaches 80% harvest weight (480 g) by day 5 with regular feeding
Catfish: 40 → 12 days (57.5 g/day) — intermediate difficulty
Barramundi: 45 → 14 days (27.9 g/day) — advanced
systemMoves.js — progressMultipleTurns auto-feed changed from "days 2 and 3 only" to "any day when the tank is empty." If the player manually fed before pressing Progress 3 Days, that food is used on day 1 as before. If not, inventory auto-feeds — eliminating feedFish as a required move for the multi-day path.

The 7-move path (verified):

Buy fish food → 2. Add 5 tilapia → 3. Plant Basil/Romaine → 4. Progress 3 Days (days 1–3 auto-fed) → 5. Progress 3 Days (days 4–6 auto-fed; Basil matures day 5, Romaine day 6; tilapia 600 g) → 6. Harvest plants → 7. Sell fish
Water chemistry at day 6: ammonia ~1.03 ppm (alert, not danger), nitrite < 0.3 ppm, pH 7.0. The 7-day grace period blocks all events for the entire path.

Both READMEs updated with new fish harvest times, the 7-move first-harvest table, corrected ammonia production figure (1.83 ppm/day for 5 tilapia, not 0.77), and the updated Progress 3 Days auto-feed description.




Check the REACT + X3D pattern for the case when the same plant or fish 3d model is used repeatedly in a live scene. For example, if an X3D <Inline url='IBO.glb'/> is used multiple times, one can use the pattern of :

first instance:
<Inline url='IBO.glb' DEF='IBO' /> 

Subsequent instances:
<Inline USE='IBO' /> 


Scope: 
Now let's inspect the play routes and event logic that lead to a user front end display in the:

 - Notification panel (back background) with text like 'Plants lost: '
OR the
- Fish or Plant panel
 with text like : 'Plant losses: '

Request:
These components should also surface reasons why the fish or plant die off occurred for the user.



In the top level buttons of the right hand panel (e.g. Market, Water, Plants, Inventory, Fish, Bills, Events), let's make thosee buttons to be styled more prominently as tab headers.


Let's inspect the rate of health decline for both fish and plants and find a realistic value that still can make our 7 move goal possible.




We are still seeing issues in the plant and fish stocks not updating properly in the game state or the 3D renderer. Please  trace the events and logic for truth and consistency.




📜 Recent History (from day 80)
nitrite Spike:  Day 79
ammonia Spike: Day 73
p H Crash: Day 69