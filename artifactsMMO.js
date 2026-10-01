const CHARACTER_NAME = "ethanol";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhbWluZ3dpdGhlaXRoYW5AZ21haWwuY29tIiwicGFzc3dvcmRfY2hhbmdlZCI6bnVsbH0.Ai8mlBeQDZZMifDTmMonGnMI8zgNJm6w8_QYKUed4iY";

if (!TOKEN) {
    throw new Error("Set the ARTIFACTS_MMO_TOKEN environment variable before running the bot.");
}
const BANK_MAP_ID = 955;


const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
};
const body = JSON.stringify({});


function sleep(seconds) {
    console.log(`⏳ Cooldown started: ${seconds} seconds`);
    return new Promise(resolve => { setTimeout(resolve, seconds * 1000); });
}


async function get_Characters(){
    const url = 'https://api.artifactsmmo.com/my/characters';
    return getJson(url);
}


async function getJson(url) {
    const response = await fetch(url, {method: "GET", headers});
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`${response.status}: ${JSON.stringify(data)}`);
    }
    return data;
}


const itemCache = new Map();
let resourcesCache;
const resourceMapCache = new Map();
const workshopMapCache = new Map();


async function getAllItems() {
    if (!itemCache.has("items")) {
        const data = await getJson("https://api.artifactsmmo.com/items?size=10000");
        itemCache.set("items", data?.data ?? []);
    }
    return itemCache.get("items");
}


async function getAllResources() {
    if (!resourcesCache) {
        const data = await getJson("https://api.artifactsmmo.com/resources?size=10000");
        resourcesCache = data?.data ?? [];
    }
    return resourcesCache;
}


async function getResourceMaps(resourceCode) {
    if (!resourceMapCache.has(resourceCode)) {
        const url = `https://api.artifactsmmo.com/maps?content_type=resource&content_code=${encodeURIComponent(resourceCode)}&hide_blocked_maps=true&size=10000`;
        const data = await getJson(url);
        resourceMapCache.set(resourceCode, data?.data ?? []);
    }
    return resourceMapCache.get(resourceCode);
}


async function getWorkshopMaps(skill) {
    if (!workshopMapCache.has(skill)) {
        const url = `https://api.artifactsmmo.com/maps?content_type=workshop&content_code=${encodeURIComponent(skill)}&hide_blocked_maps=true&size=10000`;
        const data = await getJson(url);
        workshopMapCache.set(skill, data?.data ?? []);
    }
    return workshopMapCache.get(skill);
}


function nearestMap(maps, character, currentPosition) {
    const accessibleMaps = maps.filter(map => map.layer === character.layer);
    const candidates = accessibleMaps.length > 0 ? accessibleMaps : maps;
    return candidates.sort((left, right) =>
        Math.abs(left.x - currentPosition.x) + Math.abs(left.y - currentPosition.y) -
        (Math.abs(right.x - currentPosition.x) + Math.abs(right.y - currentPosition.y))
    )[0];
}


function inventoryQuantity(character, itemCode) {
    return (character.inventory ?? [])
        .filter(item => item?.code === itemCode)
        .reduce((total, item) => total + item.quantity, 0);
}


async function createBatchMaterialPlan(character, recipe, resources, currentPosition) {
    const materialNeeds = [];
    for (const ingredient of recipe.craft.items) {
        const missingQuantity = ingredient.quantity - inventoryQuantity(character, ingredient.code);
        if (missingQuantity <= 0) {
            continue;
        }

        const resourceCandidates = resources
            .filter(resource =>
                resource.drops?.some(drop => drop.code === ingredient.code) &&
                Number.isFinite(character[`${resource.skill}_level`]) &&
                character[`${resource.skill}_level`] >= resource.level
            )
            .sort((left, right) => left.level - right.level);

        for (const resource of resourceCandidates) {
            const resourceMaps = await getResourceMaps(resource.code);
            const destination = nearestMap(resourceMaps, character, currentPosition);
            if (destination) {
                materialNeeds.push({
                    code: ingredient.code,
                    quantity: missingQuantity,
                    resourceCode: resource.code,
                    mapId: destination.map_id
                });
                break;
            }
        }
    }
    return materialNeeds;
}


const SKILL_NAMES = [
    "mining",
    "woodcutting",
    "fishing",
    "weaponcrafting",
    "gearcrafting",
    "jewelrycrafting",
    "cooking",
    "alchemy"
];


const EQUIPMENT_SLOTS = [
    "weapon",
    "shield",
    "helmet",
    "body_armor",
    "leg_armor",
    "boots",
    "ring1",
    "ring2",
    "amulet",
    "artifact1",
    "artifact2",
    "artifact3",
    "utility1",
    "utility2",
    "bag",
    "rune"
];


function lowestSkill(character) {
    return SKILL_NAMES
        .map(skill => ({ skill, level: character[`${skill}_level`] ?? 0 }))
        .sort((left, right) => left.level - right.level)[0];
}


function missingEquipment(character) {
    return EQUIPMENT_SLOTS.filter(slot => !character[`${slot}_slot`]);
}


function itemFitsSlot(item, slot) {
    if (slot.startsWith("ring")) return item.type === "ring";
    if (slot.startsWith("artifact")) return item.type === "artifact";
    if (slot.startsWith("utility")) return item.type === "utility";
    return item.type === slot;
}


function equipmentProgressionSkill(character, items) {
    const skills = missingEquipment(character)
        .flatMap(slot => items
            .filter(item => itemFitsSlot(item, slot) && item.craft?.skill)
            .map(item => item.craft.skill)
        );
    return [...new Set(skills)]
        .sort((left, right) =>
            (character[`${left}_level`] ?? 0) - (character[`${right}_level`] ?? 0)
        )[0];
}


async function findProductionStep(character, recipe, items, resources, currentPosition, visited = new Set()) {
    if (visited.has(recipe.code)) {
        return null;
    }
    visited.add(recipe.code);

    for (const ingredient of recipe.craft.items) {
        const missingQuantity = ingredient.quantity - inventoryQuantity(character, ingredient.code);
        if (missingQuantity <= 0) {
            continue;
        }

        const prerequisite = items.find(item =>
            item.code === ingredient.code &&
            item.craft?.skill &&
            character[`${item.craft.skill}_level`] >= item.craft.level
        );
        if (prerequisite) {
            const prerequisiteStep = await findProductionStep(
                character,
                prerequisite,
                items,
                resources,
                currentPosition,
                new Set(visited)
            );
            if (prerequisiteStep) {
                return prerequisiteStep;
            }
        }

        const resourceCandidates = resources
            .filter(resource =>
                resource.drops?.some(drop => drop.code === ingredient.code) &&
                Number.isFinite(character[`${resource.skill}_level`]) &&
                character[`${resource.skill}_level`] >= resource.level
            )
            .sort((left, right) => left.level - right.level);
        for (const resource of resourceCandidates) {
            const resourceMaps = await getResourceMaps(resource.code);
            const destination = nearestMap(resourceMaps, character, currentPosition);
            if (destination) {
                return {
                    action: "gather",
                    code: ingredient.code,
                    quantity: missingQuantity,
                    resourceCode: resource.code,
                    mapId: destination.map_id
                };
            }
        }
    }

    const workshopMaps = await getWorkshopMaps(recipe.craft.skill);
    const workshop = nearestMap(workshopMaps, character, currentPosition);
    return workshop
        ? { action: "craft", recipeCode: recipe.code, workshopMapId: workshop.map_id }
        : null;
}


async function findEquipmentPlan(character, items, resources, currentPosition) {
    const missingSlots = missingEquipment(character);
    for (const slot of missingSlots) {
        const inventoryItem = items.find(item =>
            itemFitsSlot(item, slot) && inventoryQuantity(character, item.code) > 0
        );
        if (inventoryItem) {
            return { action: "equip", equipmentCode: inventoryItem.code, equipmentSlot: slot };
        }

        const recipes = items
            .filter(item => itemFitsSlot(item, slot) && item.craft?.skill && item.craft?.items?.length)
            .filter(item => character[`${item.craft.skill}_level`] >= item.craft.level)
            .sort((left, right) =>
                character[`${left.craft.skill}_level`] - character[`${right.craft.skill}_level`] ||
                left.level - right.level
            );

        for (const recipe of recipes) {
            const workshopMaps = await getWorkshopMaps(recipe.craft.skill);
            const workshop = nearestMap(workshopMaps, character, currentPosition);
            if (!workshop) continue;

            const productionStep = await findProductionStep(
                character,
                recipe,
                items,
                resources,
                currentPosition
            );
            if (productionStep?.action === "craft" && productionStep.recipeCode === recipe.code) {
                return {
                    action: "craftEquipment",
                    recipeCode: recipe.code,
                    equipmentSlot: slot,
                    workshopMapId: workshop.map_id
                };
            }
            if (productionStep?.action === "craft") {
                return {
                    action: "craftMaterial",
                    ...productionStep,
                    equipmentSlot: slot,
                    targetRecipeCode: recipe.code
                };
            }
            if (productionStep?.action === "gather") {
                return {
                    action: "gatherEquipmentMaterial",
                    ...productionStep,
                    equipmentSlot: slot,
                    recipeCode: recipe.code
                };
            }
        }
    }
    return null;
}


async function chooseSkillPlan(character) {
    const items = await getAllItems();
    const resources = await getAllResources();
    const recipes = items.filter(item => item.craft?.skill && item.craft?.items?.length);
    const gatheringSkills = new Set(["mining", "woodcutting", "fishing", "alchemy"]);
    const candidates = [];
    const currentMap = await getJson(`https://api.artifactsmmo.com/maps/id/${character.map_id}`);
    const currentPosition = currentMap?.data;
    const equipmentPlan = await findEquipmentPlan(character, items, resources, currentPosition);
    if (equipmentPlan) {
        return equipmentPlan;
    }
    const targetSkill = equipmentProgressionSkill(character, items) ?? lowestSkill(character).skill;
    const craftableRecipes = recipes
        .filter(recipe => character[`${recipe.craft.skill}_level`] >= recipe.craft.level)
        .sort((left, right) =>
            Number(right.craft.skill === targetSkill) - Number(left.craft.skill === targetSkill) ||
            character[`${left.craft.skill}_level`] - character[`${right.craft.skill}_level`] ||
            left.craft.level - right.craft.level
        );

    for (const recipe of craftableRecipes) {
        const hasAllMaterials = recipe.craft.items.every(ingredient =>
            inventoryQuantity(character, ingredient.code) >= ingredient.quantity
        );
        if (hasAllMaterials) {
            const workshopMaps = await getWorkshopMaps(recipe.craft.skill);
            const workshop = nearestMap(workshopMaps, character, currentPosition);
            if (!workshop) {
                continue;
            }
            return {
                action: "craft",
                craftSkill: recipe.craft.skill,
                craftLevel: recipe.craft.level,
                recipeCode: recipe.code,
                workshopMapId: workshop.map_id
            };
        }
    }

    for (const recipe of recipes) {
        const craftSkill = recipe.craft.skill;
        const craftLevel = character[`${craftSkill}_level`];
        if (!Number.isFinite(craftLevel) || craftLevel < recipe.craft.level) {
            continue;
        }

        for (const ingredient of recipe.craft.items) {
            if (inventoryQuantity(character, ingredient.code) >= ingredient.quantity) {
                continue;
            }

            for (const resource of resources) {
                if (!gatheringSkills.has(resource.skill) ||
                    !resource.drops?.some(drop => drop.code === ingredient.code)) {
                    continue;
                }

                const gatheringSkill = resource.skill;
                const gatheringLevel = character[`${gatheringSkill}_level`];
                if (Number.isFinite(gatheringLevel) && gatheringLevel >= resource.level) {
                    candidates.push({
                        craftSkill,
                        craftLevel: recipe.craft.level,
                        recipeCode: recipe.code,
                        resourceCode: resource.code,
                        gatheringSkill,
                        gatheringLevel,
                        resourceLevel: resource.level
                    });
                }
            }
        }
    }

    candidates.sort((left, right) =>
        Number(right.gatheringSkill === targetSkill || right.craftSkill === targetSkill) -
        Number(left.gatheringSkill === targetSkill || left.craftSkill === targetSkill) ||
        left.gatheringLevel - right.gatheringLevel ||
        left.resourceLevel - right.resourceLevel ||
        left.craftLevel - right.craftLevel
    );

    for (const candidate of candidates.slice(0, 20)) {
        const recipe = recipes.find(item => item.code === candidate.recipeCode);
        if (!recipe) {
            continue;
        }
        const materialNeeds = await createBatchMaterialPlan(character, recipe, resources, currentPosition);
        if (materialNeeds.length > 0) {
            return {
                ...candidate,
                ...materialNeeds[0],
                action: "gather",
                materialNeeds
            };
        }
    }

    return null;
}


async function action(url, body) {
    if (!body) {
        body = JSON.stringify({});
    }
    try {
        const response = await fetch(url, {method: "POST", headers: headers, body: body});
        const data = await response.json();
        if (!response.ok || data?.error) {
            throw new Error(`${response.status}: ${JSON.stringify(data)}`);
        }
        const remaining = data?.data?.cooldown?.remaining_seconds ?? 0;
        if (remaining > 0) {
            await sleep(remaining);
        }
        return data?.data ?? data;
    } 
    catch (error) {
        console.error(`Action failed: ${error.message}`);
        return null;
    }
}


async function move(x,y) {
    
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/move';
    const body = JSON.stringify({ x, y });
    await action(url, body);
}


async function moveToBank() {
    const url = `https://api.artifactsmmo.com/my/${CHARACTER_NAME}/action/move`;
    return action(url, JSON.stringify({ map_id: BANK_MAP_ID }));
}


async function moveToResource(skillPlan) {
    const url = `https://api.artifactsmmo.com/my/${CHARACTER_NAME}/action/move`;
    return action(url, JSON.stringify({ map_id: skillPlan.mapId }));
}


async function moveToWorkshop(skillPlan) {
    const url = `https://api.artifactsmmo.com/my/${CHARACTER_NAME}/action/move`;
    return action(url, JSON.stringify({ map_id: skillPlan.workshopMapId }));
}


async function depositInventory(character) {
    if (character.map_id !== BANK_MAP_ID) {
        return moveToBank();
    }

    const items = (character.inventory ?? [])
        .filter(item => item?.code && item.quantity > 0)
        .map(item => ({ code: item.code, quantity: item.quantity }));

    if (items.length === 0) {
        return null;
    }

    const url = `https://api.artifactsmmo.com/my/${CHARACTER_NAME}/action/bank/deposit/item`;
    for (let index = 0; index < items.length; index += 20) {
        const batch = items.slice(index, index + 20);
        await action(url, JSON.stringify(batch));
    }
}


async function find_Monster(monsterCode){
    const url = `https://api.artifactsmmo.com/monsters/${monsterCode}`;
        const data = await getJson(url);
        return data.data;
}


async function find_MonsterInfoOnPlayerTile() {
    const tileContent = await check_PlayerTiles();
    console.log(tileContent);
    if (tileContent.type === "monster") {
        console.log(JSON.stringify(tileContent.code));
        const monster = await find_Monster(tileContent.code);
        console.log(JSON.stringify(monster));
    }
}


async function rest(){
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/rest';
    await action(url, undefined);
}


async function fight() {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/fight';
    return action(url, JSON.stringify({ participants: [CHARACTER_NAME] }));
}


async function gather(){
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/gathering';
    const data = await action(url);
}


async function craft(skillPlan) {
    const url = `https://api.artifactsmmo.com/my/${CHARACTER_NAME}/action/crafting`;
    return action(url, JSON.stringify({ code: skillPlan.recipeCode, quantity: 1 }));
}


async function equip(skillPlan) {
    const url = `https://api.artifactsmmo.com/my/${CHARACTER_NAME}/action/equip`;
    return action(url, JSON.stringify([{
        code: skillPlan.equipmentCode,
        slot: skillPlan.equipmentSlot
    }]));
}


async function find_TileContent(map_id){
    const url = `https://api.artifactsmmo.com/maps/id/${map_id}`;
    const data = await getJson(url);
    return data?.data?.interactions?.content ?? [];
}


async function check_PlayerTiles(player){
    const map_id = player.map_id;
    const tileContent = await find_TileContent(map_id);
    if (!Array.isArray(tileContent)) {
        return tileContent;
    }
    return tileContent.find(tile => tile.x === player.x && tile.y === player.y) ?? {};
}


async function check_IfTaskTaken() {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/task/complete';
    const data = await get_Characters();

}


async function check_IfTaskComplete() {


}
async function accept_NewTask() {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/task/new';



}


async function observe() {
    const characters = await get_Characters();
    const character = characters?.data?.find(item => item.name === CHARACTER_NAME);
    if (!character) {
        throw new Error(`Character ${CHARACTER_NAME} was not found.`);
    }

    const tile = await check_PlayerTiles(character);
    const monster = tile.type === "monster" && tile.code
        ? await find_Monster(tile.code)
        : null;
    const skillPlan = await chooseSkillPlan(character);
    return { character, tile, monster, skillPlan };
}


function isInventoryFull(character) {
    const inventory = Array.isArray(character.inventory) ? character.inventory : [];
    const occupiedSlots = inventory.filter(item => item?.code && item.quantity > 0).length;
    const maximumSlots = character.inventory_max_items ?? character.inventory?.max_slots;
    return Number.isFinite(maximumSlots) && occupiedSlots >= maximumSlots;
}


function scoreAction(actionToScore, state) {
    const { character, tile, monster, skillPlan } = state;
    const healthRatio = character.hp / character.max_hp;

    if (healthRatio < 0.5) {
        return actionToScore === "rest" ? 10000 : -10000;
    }
    if (isInventoryFull(character)) {
        return actionToScore === "bank" ? 10000 : -10000;
    }
    if (actionToScore === "equipment") {
        return skillPlan && ["equip", "craftEquipment", "craftMaterial", "gatherEquipmentMaterial"].includes(skillPlan.action)
            ? 2000
            : -10000;
    }
    if (actionToScore === "craft") {
        return skillPlan?.action === "craft" ? 1000 : -10000;
    }
    if (actionToScore === "skill") {
        return skillPlan?.action === "gather" ? 90 : -10000;
    }
    if (actionToScore === "fight") {
        return monster && monster.level <= character.level + 2 ? 100 : -10000;
    }
    if (actionToScore === "gather") {
        return skillPlan && tile.type === "resource" && tile.code === skillPlan.resourceCode ? 100 : -10000;
    }
    return actionToScore === "rest" && healthRatio < 0.8 ? 30 : -20;
}


function chooseAction(state) {
    return ["rest", "equipment", "craft", "fight", "gather", "skill", "bank"]
        .map(actionToScore => ({
            action: actionToScore,
            score: scoreAction(actionToScore, state)
        }))
        .sort((left, right) => right.score - left.score)[0].action;
}


async function execute(actionToExecute, state) {
    if (actionToExecute === "rest") return rest();
    if (actionToExecute === "equipment") {
        if (state.skillPlan.action === "equip") {
            return equip(state.skillPlan);
        }
        if (["craftEquipment", "craftMaterial"].includes(state.skillPlan.action)) {
            if (state.character.map_id !== state.skillPlan.workshopMapId) {
                return moveToWorkshop(state.skillPlan);
            }
            return craft(state.skillPlan);
        }
        if (state.character.map_id === state.skillPlan.mapId &&
            state.tile.type === "resource" && state.tile.code === state.skillPlan.resourceCode) {
            return gather();
        }
        return moveToResource(state.skillPlan);
    }
    if (actionToExecute === "craft") {
        if (state.character.map_id !== state.skillPlan.workshopMapId) {
            return moveToWorkshop(state.skillPlan);
        }
        return craft(state.skillPlan);
    }
    if (actionToExecute === "fight") return fight();
    if (actionToExecute === "gather") return gather();
    if (actionToExecute === "skill") {
        if (state.character.map_id === state.skillPlan.mapId &&
            state.tile.type === "resource" && state.tile.code === state.skillPlan.resourceCode) {
            return gather();
        }
        return moveToResource(state.skillPlan);
    }
    if (actionToExecute === "bank") return depositInventory(state.character);
    throw new Error(`Unsupported action: ${actionToExecute}`);
}


async function get_GeBuyOrders(){
    const url = 'https://api.artifactsmmo.com/grandexchange/orders?type=buy';
    const options = {method: 'GET', headers: {Accept: 'application/json'}};

    try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log(data);
    } 
    catch (error) {
    console.error(error);
    }
}


async function main() {
    while (true) {
        try {
            const state = await observe();
            const selectedAction = chooseAction(state);
            console.log(`${state.character.name}: ${selectedAction}`);
            await execute(selectedAction, state);
        } catch (error) {
            console.error(`Decision loop failed: ${error.message}`);
            await sleep(10);
        }
    }
}
await main();