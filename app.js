import * as THREE from "./vendor/three/build/three.module.js";
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";
import { MODEL_DEFINITIONS } from "./models.js";

const canvas = document.getElementById("sceneCanvas");
const modelButtons = document.getElementById("modelButtons");
const sceneTitle = document.getElementById("sceneTitle");
const infoTitle = document.getElementById("infoTitle");
const summaryText = document.getElementById("summaryText");
const highlightList = document.getElementById("highlightList");
const citationText = document.getElementById("citationText");
const noteText = document.getElementById("noteText");
const stageLabel = document.getElementById("stageLabel");
const stageDescription = document.getElementById("stageDescription");
const stageTimeline = document.getElementById("stageTimeline");
const playPauseButton = document.getElementById("playPauseButton");
const restartButton = document.getElementById("restartButton");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x060d16, 0.055);

const camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
camera.position.set(0, 4.2, 14.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 24;
controls.maxPolarAngle = Math.PI * 0.48;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;
controls.target.set(0, 0.4, 0);

const ambient = new THREE.AmbientLight(0x89b6ff, 0.5);
const keyLight = new THREE.PointLight(0x62d6ff, 16, 70, 2);
keyLight.position.set(10, 8, 8);
const warmLight = new THREE.PointLight(0xffb46f, 12, 60, 2);
warmLight.position.set(-8, 4, -10);
scene.add(ambient, keyLight, warmLight);

const root = new THREE.Group();
root.userData.cameraTarget = new THREE.Vector3(0, 0.4, 0);
scene.add(root);

const starField = createStarField();
scene.add(starField);

const clock = new THREE.Clock();
let paused = false;
let pausedOffset = 0;
let pausedAt = 0;
let activeModel = MODEL_DEFINITIONS[0];
let activeExperience = null;
let activeStageIndex = -1;

buildModelButtons();
activateModel(activeModel.id);
animate();

playPauseButton.addEventListener("click", () => {
  if (paused) {
    pausedOffset += clock.getElapsedTime() - pausedAt;
    paused = false;
  } else {
    pausedAt = clock.getElapsedTime();
    paused = true;
  }
  playPauseButton.textContent = paused ? "继续" : "暂停";
});

restartButton.addEventListener("click", () => {
  jumpToProgress(0);
});

window.addEventListener("resize", handleResize);

function createStarField() {
  const geometry = new THREE.BufferGeometry();
  const count = 1800;
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const radius = 26 + Math.random() * 38;
    const theta = Math.random() * Math.PI;
    const phi = Math.random() * Math.PI * 2;
    positions[index * 3] = radius * Math.sin(theta) * Math.cos(phi);
    positions[index * 3 + 1] = radius * Math.cos(theta) * 0.7;
    positions[index * 3 + 2] = radius * Math.sin(theta) * Math.sin(phi);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xa9d6ff,
      size: 0.09,
      transparent: true,
      opacity: 0.62,
      depthWrite: false
    })
  );
}

function buildModelButtons() {
  MODEL_DEFINITIONS.forEach((model) => {
    const button = document.createElement("button");
    button.className = "model-button";
    button.type = "button";
    button.dataset.modelId = model.id;
    button.innerHTML = `<strong>${model.title}</strong><span>${model.buttonText}</span>`;
    button.addEventListener("click", () => activateModel(model.id));
    modelButtons.appendChild(button);
  });
}

function activateModel(modelId) {
  const nextModel = MODEL_DEFINITIONS.find((model) => model.id === modelId);
  if (!nextModel) {
    return;
  }

  activeModel = nextModel;
  activeStageIndex = -1;
  pausedOffset = clock.getElapsedTime();
  pausedAt = pausedOffset;

  if (activeExperience) {
    activeExperience.dispose();
  }

  root.userData.cameraTarget.set(0, 0.4, 0);
  activeExperience = activeModel.createExperience(root);

  updateModelInfo();
  document.querySelectorAll(".model-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.modelId === modelId);
  });
}

function updateModelInfo() {
  sceneTitle.textContent = activeModel.title;
  infoTitle.textContent = activeModel.title;
  summaryText.textContent = activeModel.summary;
  citationText.textContent = activeModel.citation;
  noteText.textContent = activeModel.note;

  highlightList.innerHTML = "";
  activeModel.highlights.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    highlightList.appendChild(item);
  });

  stageTimeline.innerHTML = "";
  activeModel.stages.forEach((stage, index) => {
    const item = document.createElement("button");
    item.className = "stage-chip";
    item.type = "button";
    item.dataset.stageIndex = String(index);
    item.setAttribute("aria-label", `切换到${stage.label}阶段`);
    item.innerHTML = `<strong>${stage.label}</strong><span>${stage.description}</span>`;
    item.addEventListener("click", () => jumpToStage(index));
    stageTimeline.appendChild(item);
  });

  stageLabel.textContent = activeModel.stages[0].label;
  stageDescription.textContent = activeModel.stages[0].description;
}

function handleResize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function getStageIndex(progress) {
  const index = activeModel.stages.findIndex((stage) => progress >= stage.range[0] && progress < stage.range[1]);
  return index >= 0 ? index : activeModel.stages.length - 1;
}

function updateStageUI(progress) {
  const stageIndex = getStageIndex(progress);
  if (stageIndex === activeStageIndex) {
    return;
  }

  activeStageIndex = stageIndex;
  const stage = activeModel.stages[stageIndex];
  stageLabel.textContent = stage.label;
  stageDescription.textContent = stage.description;

  document.querySelectorAll(".stage-chip").forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.stageIndex) === stageIndex);
  });
}

function getCurrentReferenceTime() {
  return paused ? pausedAt : clock.getElapsedTime();
}

function jumpToProgress(progress) {
  if (!activeExperience) {
    return;
  }

  const clamped = Math.min(Math.max(progress, 0), 0.999);
  const referenceTime = getCurrentReferenceTime();
  const targetTime = activeExperience.duration * clamped;
  pausedOffset = referenceTime - targetTime;

  if (paused) {
    pausedAt = referenceTime;
  }

  activeExperience.update(0, targetTime);
  updateStageUI(clamped);
}

function jumpToStage(stageIndex) {
  const stage = activeModel.stages[stageIndex];
  if (!stage) {
    return;
  }

  jumpToProgress(stage.range[0]);
}

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const modelTime = paused ? pausedAt - pausedOffset : elapsed - pausedOffset;

  if (!paused && activeExperience) {
    activeExperience.update(clock.getDelta(), modelTime);
  } else {
    clock.getDelta();
  }

  if (activeExperience) {
    updateStageUI(activeExperience.getProgress());
  }

  controls.target.lerp(root.userData.cameraTarget, 0.06);
  starField.rotation.y += 0.0007;
  controls.update();
  renderer.render(scene, camera);
}
