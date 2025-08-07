const wdio = require("webdriverio");
const { OBSWebSocket } = require("obs-websocket-js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const opts = {
  path: "/",
  port: 4723,
  capabilities: {
    platformName: "Android",
    "appium:deviceName": "emulator-5554",
    "appium:automationName": "UiAutomator2",
    "appium:appPackage": "com.tis.omoservice",
    "appium:appActivity": "com.example.omo_service.MainActivity",
  },
};

// OBS Configuration
const OBS_IP = "192.168.1.103";
const OBS_PORT = 4455;
const OBS_PASSWORD = "srWytMR9Vp1qHiiQ";
const SCENE_NAME = "Scene";
const SOURCE_NAME = "NodeImageSource";
const IMAGE_URL = "https://placehold.co/600x400";

// Function to download image from URL and convert to base64
async function downloadImageAsBase64(imageUrl) {
  try {
    console.log("กำลังดาวน์โหลดรูปภาพจาก:", imageUrl);
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const base64 = Buffer.from(response.data, "binary").toString("base64");
    console.log("ดาวน์โหลดรูปภาพสำเร็จ");
    return base64;
  } catch (error) {
    console.error("Error downloading image:", error);
    throw error;
  }
}

// Function to inject image directly to device camera folder
async function injectImageToCamera(driver, imageBase64) {
  try {
    console.log("กำลัง inject รูปภาพเข้ากล้อง...");

    // Save image to temp file for reference
    const tempImagePath = path.join(__dirname, "camera_image.jpg");
    fs.writeFileSync(tempImagePath, imageBase64, "base64");

    // Push to multiple camera-related folders
    await driver.pushFile("/sdcard/DCIM/Camera/camera_image.jpg", imageBase64);
    await driver.pushFile("/sdcard/Pictures/camera_image.jpg", imageBase64);
    await driver.pushFile(
      "/storage/emulated/0/DCIM/Camera/camera_image.jpg",
      imageBase64
    );
    await driver.pushFile(
      "/storage/emulated/0/Pictures/camera_image.jpg",
      imageBase64
    );

    // Trigger media scanner to refresh gallery
    await driver.execute("mobile: shell", {
      command:
        "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/DCIM/Camera/camera_image.jpg",
    });

    await driver.execute("mobile: shell", {
      command:
        "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/camera_image.jpg",
    });

    console.log("รูปภาพถูก inject เสร็จแล้ว");
  } catch (error) {
    console.error("Error injecting image:", error);
  }
}

// Function to simulate camera capture with pre-loaded image
async function simulateCameraCapture(driver, imageBase64) {
  try {
    console.log("กำลังจำลองการถ่ายรูปด้วยรูปภาพที่เตรียมไว้...");

    // Method 1: Try to use Appium's camera simulation
    try {
      await driver.execute("mobile: shell", {
        command: `echo "${imageBase64}" | base64 -d > /sdcard/DCIM/Camera/simulated_photo.jpg`,
      });
      console.log("วิธีที่ 1: ใช้ shell command สำเร็จ");
    } catch (error) {
      console.log("วิธีที่ 1 ล้มเหลว:", error.message);
    }

    // Method 2: Use Android Intent to set as recent photo
    try {
      await driver.execute("mobile: shell", {
        command:
          "am start -a android.media.action.IMAGE_CAPTURE_SECURE -n com.android.camera2/com.android.camera.CameraActivity",
      });
      await driver.pause(1000);
      console.log("วิธีที่ 2: เปิดกล้องผ่าน Intent");
    } catch (error) {
      console.log("วิธีที่ 2 ล้มเหลว:", error.message);
    }

    // Method 3: Try to override camera app behavior
    try {
      await driver.execute("mobile: shell", {
        command: "setprop camera.hal1.packagelist com.tis.omoservice",
      });
      console.log("วิธีที่ 3: ตั้งค่า camera property");
    } catch (error) {
      console.log("วิธีที่ 3 ล้มเหลว:", error.message);
    }
  } catch (error) {
    console.error("Error simulating camera capture:", error);
  }
}

// Function to setup OBS Virtual Camera for LDPlayer
async function setupOBSVirtualCameraForLDPlayer(driver) {
  try {
    console.log("กำลังตั้งค่า OBS Virtual Camera สำหรับ LDPlayer...");

    // First update OBS to show our image
    await updateOBSImage();

    // Wait a moment for OBS to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // LDPlayer specific camera configuration
    // Method 1: Configure LDPlayer camera via ADB
    await driver.execute("mobile: shell", {
      command: "setprop persist.vendor.camera.privapp.list com.tis.omoservice",
    });

    // Method 2: LDPlayer specific properties
    await driver.execute("mobile: shell", {
      command: "setprop ro.kernel.qemu.camera.fake.rotate 0",
    });

    // Method 3: Set camera permissions
    await driver.execute("mobile: shell", {
      command: "pm grant com.tis.omoservice android.permission.CAMERA",
    });

    console.log("หมายเหตุ: สำหรับ LDPlayer:");
    console.log("1. เปิด LDPlayer Settings > Advanced > Camera");
    console.log("2. เลือก Camera Mode เป็น Computer Camera");
    console.log("3. เลือก OBS Virtual Camera หรือ OBS Camera");
    console.log("4. กด Apply และรีสตาร์ท LDPlayer");

    console.log("OBS Virtual Camera setup เสร็จแล้ว");
  } catch (error) {
    console.error("Error setting up OBS Virtual Camera:", error);
  }
}

// Function to start OBS Virtual Camera
async function startOBSVirtualCamera() {
  const obs = new OBSWebSocket();
  try {
    await obs.connect(`ws://${OBS_IP}:${OBS_PORT}`, OBS_PASSWORD);
    console.log("เริ่มต้น OBS Virtual Camera...");

    // Start OBS Virtual Camera
    try {
      await obs.call("StartVirtualCam");
      console.log("OBS Virtual Camera เริ่มแล้ว");
    } catch (err) {
      if (err.message.includes("already active")) {
        console.log("OBS Virtual Camera ทำงานอยู่แล้ว");
      } else {
        throw err;
      }
    }

    await obs.disconnect();
  } catch (error) {
    console.error("OBS Virtual Camera error:", error);
  }
}

// Function to inject OBS image into camera feed (Simple version)
async function injectOBSImageToCamera(driver) {
  try {
    console.log("กำลัง inject รูปจาก OBS เข้ากล้อง...");

    // Method: Use OBS to capture current scene and save as image
    const obs = new OBSWebSocket();
    await obs.connect(`ws://${OBS_IP}:${OBS_PORT}`, OBS_PASSWORD);

    // Get screenshot from OBS
    const screenshot = await obs.call("GetSourceScreenshot", {
      sourceName: SOURCE_NAME,
      imageFormat: "jpg",
      imageWidth: 1280,
      imageHeight: 720,
    });

    await obs.disconnect();

    // Convert base64 to file and push to device
    const base64Data = screenshot.imageData.split(",")[1]; // Remove data:image/jpeg;base64, prefix
    const tempImagePath = path.join(__dirname, "obs_capture.jpg");
    fs.writeFileSync(tempImagePath, base64Data, "base64");

    // Push to device camera folder
    await driver.pushFile("/sdcard/DCIM/Camera/obs_image.jpg", base64Data);

    // Alternative: Push to Pictures folder
    await driver.pushFile("/sdcard/Pictures/camera_image.jpg", base64Data);

    // Trigger media scanner to refresh gallery
    await driver.execute("mobile: shell", {
      command:
        "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/DCIM/Camera/obs_image.jpg",
    });

    // Clean up
    fs.unlinkSync(tempImagePath);

    console.log("OBS รูปภาพถูก inject เสร็จแล้ว");
  } catch (error) {
    console.error("Error injecting OBS image:", error);
  }
}

// Function to inject image directly into LDPlayer camera feed
async function injectOBSImageToLDPlayer(driver) {
  try {
    console.log("กำลัง inject รูปจาก OBS เข้า LDPlayer...");

    // Method: Use OBS to capture current scene and save as image
    const obs = new OBSWebSocket();
    await obs.connect(`ws://${OBS_IP}:${OBS_PORT}`, OBS_PASSWORD);

    // Get screenshot from OBS
    const screenshot = await obs.call("GetSourceScreenshot", {
      sourceName: SOURCE_NAME,
      imageFormat: "jpg",
      imageWidth: 1280,
      imageHeight: 720,
    });

    await obs.disconnect();

    // Convert base64 to file and push to device
    const base64Data = screenshot.imageData.split(",")[1]; // Remove data:image/jpeg;base64, prefix
    const tempImagePath = path.join(__dirname, "ldplayer_capture.jpg");
    fs.writeFileSync(tempImagePath, base64Data, "base64");

    // Push to LDPlayer shared folder (usually accessible)
    await driver.pushFile("/sdcard/Pictures/camera_image.jpg", base64Data);

    // LDPlayer specific: Use shared folder method
    await driver.execute("mobile: shell", {
      command: "cp /sdcard/Pictures/camera_image.jpg /sdcard/DCIM/Camera/",
    });

    // Set as recent camera image
    await driver.execute("mobile: shell", {
      command:
        "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/DCIM/Camera/camera_image.jpg",
    });

    // Alternative method: Use LDPlayer's shared folder if available
    try {
      await driver.execute("mobile: shell", {
        command: "mkdir -p /storage/emulated/0/Pictures/Screenshots",
      });
      await driver.pushFile(
        "/storage/emulated/0/Pictures/Screenshots/obs_image.jpg",
        base64Data
      );
    } catch (sharedFolderError) {
      console.log("Shared folder method ไม่สำเร็จ:", sharedFolderError.message);
    }

    // Clean up
    fs.unlinkSync(tempImagePath);

    console.log("OBS รูปภาพถูก inject เข้า LDPlayer เสร็จแล้ว");
  } catch (error) {
    console.error("Error injecting OBS image to LDPlayer:", error);
  }
}

(async () => {
  try {
    console.log("เริ่มต้นการเชื่อมต่อ Appium...");
    const driver = await wdio.remote(opts);
    console.log("เชื่อมต่อ Appium สำเร็จ");
    await driver.pause(1000); // รอ 1 วิให้แอปโหลด

    // ไม่ต้องเริ่มต้น OBS Virtual Camera แล้ว
    // await startOBSVirtualCamera();

    // กรอกชื่อผู้ใช้งาน
    console.log("หาช่องกรอกชื่อผู้ใช้งาน");
    const usernameInput = await driver.$(
      '//android.view.View[@content-desc="ชื่อผู้ใช้งาน\n*\nรหัสผ่าน\n*"]/android.widget.EditText[1]'
    );
    await usernameInput.click();
    await usernameInput.setValue("405121010");

    // กรอกรหัสผ่าน
    console.log("หาช่องกรอกรหัสผ่าน");
    const passwordInput = await driver.$(
      '//android.view.View[@content-desc="ชื่อผู้ใช้งาน\n*\nรหัสผ่าน\n*"]/android.widget.EditText[2]'
    );
    await passwordInput.click();
    await passwordInput.setValue("Puy11111111");

    // กดปุ่มเข้าสู่ระบบ
    console.log("กดปุ่มเข้าสู่ระบบ");
    const loginBtn = await driver.$(
      '//android.widget.Button[@content-desc="เข้าสู่ระบบ"]'
    );
    await loginBtn.click();

    await driver.pause(1000);
    const selectUser = await driver.$(
      '//android.view.View[@content-desc="อน\nอนุสสรา\nโตสุข"]'
    );
    await selectUser.click();

    const pincode = "123456";
    await driver.pause(1000);
    const pincodeDigits = pincode.split("");
    for (const digit of pincodeDigits) {
      const pinButton = await driver.$(
        `//android.widget.Button[@content-desc="${digit}"]`
      );
      await pinButton.click();
    }

    await driver.pause(1000);
    const slectBranch = await driver.$(
      '//android.widget.ImageView[@content-desc="บริษัท ประชากิจมอเตอร์เซลส์ จำกัด\nสำนักงานใหญ่"]'
    );
    await slectBranch.waitForDisplayed({ timeout: 1000 });
    await slectBranch.click();

    const selectRole = await driver.$(
      '//android.view.View[@content-desc="หัวหน้าช่าง"]'
    );
    await selectRole.waitForDisplayed({ timeout: 1000 });
    await selectRole.click();

    const confirmBtn = await driver.$(
      '//android.widget.Button[@content-desc="ยืนยัน"]'
    );
    await confirmBtn.waitForDisplayed({ timeout: 1000 });
    await confirmBtn.click();

    await driver.pause(3000); // รอให้โหลดหน้าเช็กอิน

    // const imageBase64 = await downloadImageAsBase64(IMAGE_URL);
    // await injectImageToCamera(driver, imageBase64);

    const checkInBtn = await driver.$(
      '(//android.widget.Button[@content-desc="เช็กอิน"])[1]'
    );
    await checkInBtn.waitForDisplayed({ timeout: 1000 });
    await checkInBtn.click();
    const takePhotoBtn = await driver.$(
        '//android.widget.ImageView[@content-desc="ถ่ายภาพหน้ารถ"]'
    );
    await takePhotoBtn.waitForDisplayed({ timeout: 1000 });
    await takePhotoBtn.click();
    
    // await injectImageToCamera(driver, imageBase64);
    // await simulateCameraCapture(driver, imageBase64);
    
    await driver.pause(3000); // รอให้โหลดหน้าเช็กอิน
    const permissionAllowBtn = await driver.$(
      '//android.widget.Button[@resource-id="com.android.packageinstaller:id/permission_allow_button"]'
    );
    await permissionAllowBtn.waitForDisplayed({ timeout: 1000 });
    await permissionAllowBtn.click();
    await driver.pause(100000); // รอให้กล้องเปิด


    console.log("สคริปต์ทำงานจบแล้ว");
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err);
  }
})();
