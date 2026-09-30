const CHARACTER_NAME = "ethanol";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhbWluZ3dpdGhlaXRoYW5AZ21haWwuY29tIiwicGFzc3dvcmRfY2hhbmdlZCI6bnVsbH0.Ai8mlBeQDZZMifDTmMonGnMI8zgNJm6w8_QYKUed4iY";


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
    const response = await fetch(url, {method: `GET`, headers: headers});
    const data = await response.json();
    return data;
}


async function get_CharacterLogs(){
    const url = 'https://api.artifactsmmo.com/my/logs/ethanol';
    const response = await fetch(url, {method: `GET`, headers: headers});
    const data = await response.json();
    return data;
}


async function action(url, body) {
    if (!body) {
        body = JSON.stringify({});
    }
    try {
        const response = await fetch(url, {method: `POST`, headers: headers, body: body});
        const data = await response.json();
        const remaining = data?.data?.cooldown?.remaining_seconds ?? 0;
        if (remaining > 0) {
            await sleep(remaining);
        }
        return data?.data ?? data;
    } 
    catch (error) {
        console.error(error);
    }
}


async function move(x,y) {
    
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/move';
    const body = JSON.stringify({ x, y });
    await action(url, body);
}


async function find_Monster(monsterCode){
    const url = `https://api.artifactsmmo.com/monsters/${monsterCode}`;
    const options = {method: 'GET', headers: {Accept: 'application/json'}};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  return data.data;
} 
catch (error) {
  console.error(error);
}
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
    const body = JSON.stringify({ participants: ["ethanol"] });
    const data = await action(url, body);
    const fightData = data?.fight;
    console.log(fightData.turns);
    const me = characters[0];
    if (me && me.hp < me.max_hp * 0.5) {
        await rest();
    }
}


async function gather(){
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/gathering';
    const data = await action(url, body);
}


async function find_TileContent(map_id){
    const url = `https://api.artifactsmmo.com/maps/id/${map_id}`;
    const options = {method: 'GET', headers: {Accept: 'application/json'}};

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        const {content} = data.data.interactions;
        //console.log(JSON.stringify(content));
        return content;
    } 
    catch (error) {
        console.error(error);
    }
}


async function check_PlayerTiles(){
    const players = await get_Characters();
    const player_TileContent = {};
    //for (let i = 0; i < players.data.length; i++) {
    const player = players.data[0];
    const map_id = player.map_id;
    const tileContent = await find_TileContent(map_id);
    return tileContent;
    //player_TileContent[0] = tileContent;
    //}
    //console.log(player_TileContent);
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
        const characters = await get_Characters();
        const character = characters.data[0];
        // if(character.cooldown){
        //     await sleep(character.cooldown);
        // }
        console.log(character.name);
        await find_MonsterInfoOnPlayerTile();
    }
}
await main();