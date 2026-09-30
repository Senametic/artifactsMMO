const CHARACTER_NAME = "ethanol";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhbWluZ3dpdGhlaXRoYW5AZ21haWwuY29tIiwicGFzc3dvcmRfY2hhbmdlZCI6bnVsbH0.Ai8mlBeQDZZMifDTmMonGnMI8zgNJm6w8_QYKUed4iY";


const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
};



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
        const {cooldown} = data.data;
        await sleep(cooldown.remaining_seconds);
        return data.data;
    } catch (error) {
        console.error(error);
    }
}


async function move(x,y) {
    
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/move';
    const body = JSON.stringify({ x, y });
    await action(url, body);
}


async function rest(){
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/rest';
    await action(url, undefined);
}


async function fight() {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/fight';
    const body = JSON.stringify({ participants: ["ethanol"] });
    const data = await action(url, body);
    const {characters} = data;
    const {hp, max_hp} = characters[0];
    if (hp < max_hp * 0.5) {
        await rest();
    }
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
async function main() {
    while (true) {
        const data = await get_CharacterLogs();
        if(data.content){
            await sleep(data.content.cooldown.remaining_seconds);
        }
        await fight();
    }
}
await main();