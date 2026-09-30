const CHARACTER_NAME = "ethanol";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhbWluZ3dpdGhlaXRoYW5AZ21haWwuY29tIiwicGFzc3dvcmRfY2hhbmdlZCI6bnVsbH0.Ai8mlBeQDZZMifDTmMonGnMI8zgNJm6w8_QYKUed4iY";


const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
};

async function action(url, body) {
    const options = {
        method: 'POST',
        headers: headers,
        body: body
    };
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        console.log(`hello`)
        await sleep(cooldown);
    } catch (error) {
        console.error(error);
    }
}
const body = undefined;

function sleep(seconds) {
    console.log(`⏳ Cooldown started: ${seconds} seconds`);
    return new Promise(resolve => { setTimeout(resolve, seconds * 1000); });
}

async function move(x,y) {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/move';
    const body = JSON.stringify({ x, y });
    //console.log(`Moved to [${x}, ${y}]`)
    await action(url, body);
}

async function check_IfTaskTaken() {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/task/complete';
    action(url, body)
}
async function check_IfTaskComplete() {

}
async function accept_NewTask() {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/task/new';
    action(url, body)


}
async function main() {
    while (true){
        move(0, 1);
    }
}
main();