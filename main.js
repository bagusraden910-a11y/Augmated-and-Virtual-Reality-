
import * as THREE from 'three';

import { VRButton } from 'three/addons/webxr/VRButton.js';

import { XRControllerModelFactory } from
    'three/addons/webxr/XRControllerModelFactory.js';

import { OrbitControls } from
    'three/addons/controls/OrbitControls.js';

let camera, scene, renderer, orbit;

const controllers = [];

const interactables = []; // Daftar objek yang boleh berinteraksi

const raycaster = new THREE.Raycaster();

const tempMatrix = new THREE.Matrix4();

const pointer = new THREE.Vector2();

const logBox = document.getElementById('log');

const lines = [];

// Log ke layar dan console, berguna sebagai bukti pengujian
function log(msg) {
    console.log(msg);

    lines.unshift(msg);

    lines.length = Math.min(lines.length, 5);

    logBox.textContent = lines.join(' | ');
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1f2a);

    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        50
    );

    camera.position.set(0, 1.6, 2);
    scene.add(camera);

    // Pencahayaan utama
    scene.add(
        new THREE.HemisphereLight(0xffffff, 0x444455, 1.5)
    );

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(2, 4, 2);
    scene.add(sun);

    // Membuat lantai
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({
            color: 0x2e3447
        })
    );

    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Grid pada lantai
    scene.add(
        new THREE.GridHelper(
            10,
            20,
            0x555a6e,
            0x3a3f52
        )
    );

    // Tiga objek yang bisa disentuh atau digenggam
    addObject(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        0xe74c3c,
        -0.6,
        1.2,
        -1
    );

    addObject(
        new THREE.SphereGeometry(0.18, 32, 16),
        0x3498db,
        0,
        1.2,
        -1
    );

    addObject(
        new THREE.ConeGeometry(0.16, 0.35, 32),
        0x2ecc71,
        0.6,
        1.2,
        -1
    );

    // Membuat renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.xr.enabled = true;

    document.body.appendChild(renderer.domElement);

    // Tombol untuk masuk ke mode VR
    document.body.appendChild(
        VRButton.createButton(renderer)
    );

    // Kontrol mouse untuk mode desktop
    // Tidak aktif saat sesi XR
    orbit = new OrbitControls(
        camera,
        renderer.domElement
    );

    orbit.target.set(0, 1.2, -1);
    orbit.update();

    // Mengatur controller VR
    setupControllers();

    // Event saat ukuran layar berubah
    window.addEventListener('resize', onResize);

    // Event klik mouse
    renderer.domElement.addEventListener(
        'pointerdown',
        onPointerDown
    );

    // Menjalankan animasi
    renderer.setAnimationLoop(render);
}


// Fungsi untuk membuat objek 3D
function addObject(geometry, color, x, y, z) {
    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
            color: color
        })
    );

    mesh.position.set(x, y, z);

    scene.add(mesh);

    // Menyimpan objek yang bisa berinteraksi
    interactables.push(mesh);
}


// Menyesuaikan tampilan ketika ukuran layar berubah
function onResize() {
    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}

function setupControllers() {
    const modelFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
        const controller = renderer.xr.getController(i);

        // Event saat controller terhubung
        controller.addEventListener('connected', (e) => {
            controller.userData.gamepad = e.data.gamepad;
            // Untuk haptic dan thumbstick

            controller.add(buildRay());

            log(
                'Controller ' + i +
                ' terhubung (' + e.data.handedness + ')'
            );
        });

        // Event saat controller terputus
        controller.addEventListener('disconnected', () => {
            controller.clear();
        });

        // Event interaksi controller
        controller.addEventListener(
            'selectstart',
            onSelectStart
        );

        controller.addEventListener(
            'selectend',
            onSelectEnd
        );

        controller.addEventListener(
            'squeezestart',
            onSqueezeStart
        );

        scene.add(controller);
        controllers.push(controller);

        // Model fisik controller VR
        const grip = renderer.xr.getControllerGrip(i);

        grip.add(
            modelFactory.createControllerModel(grip)
        );

        scene.add(grip);
    }
}


// Membuat sinar (ray) untuk menunjuk objek
function buildRay() {
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]);

    const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
            color: 0xffffff
        })
    );

    line.name = 'ray';

    line.scale.z = 5; // Panjang sinar 5 meter

    return line;
}

 // Menghitung objek yang terkena sinar dari sebuah controller
function getIntersections(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(
        controller.matrixWorld
    );

    raycaster.ray.direction
        .set(0, 0, -1)
        .applyMatrix4(tempMatrix);

    return raycaster.intersectObjects(interactables, false);
}


// Getaran singkat pada controller (jika perangkat mendukung)
function pulse(controller, strength = 0.5, ms = 80) {
    const gp = controller.userData.gamepad;

    const actuator =
        gp && gp.hapticActuators && gp.hapticActuators[0];

    if (actuator && actuator.pulse) {
        actuator.pulse(strength, ms);
    }
}


// Trigger ditekan: genggam objek yang terkena sinar
function onSelectStart(event) {
    const controller = event.target;

    const hits = getIntersections(controller);

    if (hits.length > 0) {
        const obj = hits[0].object;

        controller.attach(obj); // Objek menjadi anak controller

        controller.userData.selected = obj;

        pulse(controller);

        log('GRAB: ' + obj.geometry.type);
    }
}


// Trigger dilepas: kembalikan objek ke scene
// Posisi dunia tetap terjaga
function onSelectEnd(event) {
    const controller = event.target;

    const obj = controller.userData.selected;

    if (obj) {
        scene.attach(obj); // Posisi dunia tetap terjaga

        controller.userData.selected = undefined;

        log('RELEASE: ' + obj.geometry.type);
    }
}


// Grip ditekan: ganti warna objek yang terkena sinar
function onSqueezeStart(event) {
    const controller = event.target;

    const hits = getIntersections(controller);

    if (hits.length > 0) {
        hits[0].object.material.color.setHex(
            Math.floor(Math.random() * 0xffffff)
        );

        pulse(controller, 0.3, 50);

        log('SQUEEZE: warna diubah');
    }
}

function render() {
    // Reset sorotan semua objek
    interactables.forEach((o) => {
        o.material.emissive.setHex(0x000000);
    });

    controllers.forEach((c) => {
        const held = c.userData.selected;

        if (held) {
            // Objek sedang digenggam: sorot objek
            // dan izinkan ubah skala dengan thumbstick
            held.material.emissive.setHex(0x222222);

            const gp = c.userData.gamepad;

            if (gp && gp.axes.length >= 4) {
                const y = gp.axes[3]; // Sumbu Y thumbstick

                if (Math.abs(y) > 0.15) {
                    // Abaikan drift kecil
                    held.scale
                        .multiplyScalar(1 - y * 0.02)
                        .clampScalar(0.3, 3);
                }
            }
        } else if (c.children.length > 0) {
            // Controller terhubung dan tidak memegang objek:
            // periksa hover
            const hits = getIntersections(c);

            if (hits.length > 0) {
                hits[0].object.material.emissive.setHex(
                    0x444444
                );
            }
        }
    });

    // Perbarui kontrol mouse jika tidak dalam mode VR
    if (!renderer.xr.isPresenting) {
        orbit.update();
    }

    renderer.render(scene, camera);
}


// Interaksi mode desktop:
// klik mouse untuk mengganti warna objek
function onPointerDown(e) {
    if (renderer.xr.isPresenting) {
        return;
    }

    pointer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(
        interactables,
        false
    );

    if (hits.length > 0) {
        hits[0].object.material.color.setHex(
            Math.floor(Math.random() * 0xffffff)
        );

        log('CLICK (desktop): warna diubah');
    }
}
 init();