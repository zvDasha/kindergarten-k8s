const mqtt = require("mqtt");
const client = mqtt.connect(process.env.MQTT_URL || "mqtt://mqtt:1883");

const cards = [
  "CARD_1",
  "CARD_2",
  "CARD_3",
  "CARD_4",
  "CARD_5",
  "CARD_6",
  "UNKNOWN_CARD",
];

client.on("connect", () => {
  console.log("Simulator turniket running!");
  console.log("Press Ctrl+C to stop.");
  setInterval(() => {
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    // const randomNumber = Math.floor(Math.random() * 20) + 1;
    // const randomCard = `CARD_${randomNumber}`;

    const data = JSON.stringify({
      rfid: randomCard,
      timestamp: new Date().toISOString(),
    });

    console.log(` Turniket sends: ${data}`);
    client.publish("kindergarten/gate", data);
  }, 10000);
});
