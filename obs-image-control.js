const OBSWebSocket = require('obs-websocket-js').OBSWebSocket;

const obs = new OBSWebSocket();

const OBS_IP = '192.168.1.103';
const OBS_PORT = 4455;
const OBS_PASSWORD = 'srWytMR9Vp1qHiiQ';

const SCENE_NAME = 'Scene'; // เปลี่ยนให้ตรงกับ scene ใน OBS ของคุณ
const SOURCE_NAME = 'NodeImageSource'; // ตั้งชื่อใหม่หรือใช้ชื่อที่มีอยู่
const IMAGE_URL = 'https://placehold.co/600x400';

(async () => {
  try {
    // Connect to OBS websocket
    await obs.connect(`ws://${OBS_IP}:${OBS_PORT}`, OBS_PASSWORD);
    console.log('Connected to OBS WebSocket!');

    // ตรวจสอบว่ามี source ชื่อนี้อยู่แล้วหรือยัง
    let sourceList = await obs.call('GetInputList');
    let sourceExists = sourceList.inputs.some(input => input.inputName === SOURCE_NAME);

    if (!sourceExists) {
      // สร้าง Browser Source ใหม่
      await obs.call('CreateInput', {
        sceneName: SCENE_NAME,
        inputName: SOURCE_NAME,
        inputKind: 'browser_source',
        inputSettings: {
          url: IMAGE_URL,
          width: 600,
          height: 400
        }
      });
      console.log('Browser Source created!');
    } else {
      // ถ้ามีแล้ว ให้เปลี่ยน url
      await obs.call('SetInputSettings', {
        inputName: SOURCE_NAME,
        inputSettings: {
          url: IMAGE_URL
        }
      });
      console.log('Browser Source updated!');
    }

    // ปิดการเชื่อมต่อ
    await obs.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('OBS error:', error);
  }
})();