
import React, {useState} from 'react';
import FishTankSection from './FishTankSection';
import PlantsSection from './PlantsSection';
import WaterSection from './WaterSection';


const StatsSection = ({gameState, loading, handleAddFish, handleFeedFish, handleSellFish, handleHarvestPlant, handlePlantSeed, handleSwitchPage}) => {

    const [page, setPage] = useState("");


    if (!gameState) {
        return;
    }

    const { G, ctx } = gameState;
    
    const modifyPage = (newPage) => {
        setPage(newPage);
        handleSwitchPage(newPage);
    }
    return (
        <div>

            <button
                onClick={() => modifyPage("water")}    
            >💧 Water</button>
            <button
             onClick={() => modifyPage("plants")}>
                🌱 Plants</button>
            <button
                onClick={() => modifyPage("fish")}
            >🐟 Fish</button>
            {page == "fish" && <FishTankSection gameState={gameState} loading={loading} handleAddFish={handleAddFish} handleFeedFish={handleFeedFish} handleSellFish={handleSellFish} /> } 
            {page == "plants" && <PlantsSection gameState={gameState} loading={loading} handleHarvestPlant={handleHarvestPlant} handlePlantSeed={handlePlantSeed} /> }
            {page == "water" && <WaterSection gameState={gameState} loading={loading} /> }
                
            
            
        </div>
    )
}



export default StatsSection;