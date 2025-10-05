const BACKEND_ORIGIN = window.APP_CONFIG.BACKEND_ORIGIN;

// --- 3D Background Animation ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('bg-canvas'),
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);

const stars = [];
function addStar() {
  const geometry = new THREE.SphereGeometry(0.1, 24, 24);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const star = new THREE.Mesh(geometry, material);

  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(100));
  star.position.set(x, y, z);
  scene.add(star);
  stars.push(star);
}
Array(200).fill().forEach(addStar);

camera.position.z = 5;

function animate() {
  requestAnimationFrame(animate);
  stars.forEach((star) => {
    star.position.z += 0.05;
    if (star.position.z > 50) {
      star.position.z = -50;
      star.position.x = THREE.MathUtils.randFloatSpread(100);
      star.position.y = THREE.MathUtils.randFloatSpread(100);
    }
  });
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- API Logic ---
const searchBtn = document.getElementById('search-btn');
const asteroidIdInput = document.getElementById('asteroid-id');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const asteroidInfoContainer = document.getElementById('asteroid-info');

const neoBtn = document.getElementById('check-neo-btn');
const neoLoader = document.getElementById('neo-loader');
const neoError = document.getElementById('neo-error-message');
const neoErrorText = document.getElementById('neo-error-text');
const neoListContainer = document.getElementById('neo-list');

async function callGeminiAPI(prompt, retries = 3, delay = 1000) {
  try {
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const response = await fetch(`${BACKEND_ORIGIN}/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        await new Promise((res) => setTimeout(res, delay));
        return callGeminiAPI(prompt, retries - 1, delay * 2); // Exponential backoff
      }
      throw new Error(`Gemini API Error: ${response.statusText}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    if (candidate && candidate.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text;
    }
    throw new Error('Invalid response structure from Gemini API.');
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

searchBtn.addEventListener('click', searchAsteroid);
asteroidIdInput.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    searchAsteroid();
  }
});

async function searchAsteroid() {
  const asteroidId = asteroidIdInput.value.trim();
  if (!asteroidId) {
    displayError('Please enter an Asteroid SPK-ID.');
    return;
  }

  loader.style.display = 'flex';
  errorMessage.style.display = 'none';
  asteroidInfoContainer.style.display = 'none';
  asteroidInfoContainer.innerHTML = '';

  try {
    const response = await fetch(`${BACKEND_ORIGIN}/neo-lookup/${asteroidId}`);
    if (!response.ok) {
      if (response.status === 404)
        throw new Error(
          `Asteroid with SPK-ID "${asteroidId}" not found. Please check the ID and try again.`
        );
      throw new Error(`NASA API returned an error: ${response.statusText}`);
    }
    const data = await response.json();
    displayAsteroidInfo(data);
  } catch (error) {
    console.error('Error fetching asteroid data:', error);
    displayError(error.message);
  } finally {
    loader.style.display = 'none';
  }
}

function displayAsteroidInfo(data) {
  const {
    name,
    orbital_data,
    absolute_magnitude_h,
    estimated_diameter,
    is_potentially_hazardous_asteroid,
  } = data;
  const diameter =
    estimated_diameter.kilometers.estimated_diameter_max.toFixed(2);
  const hazardousText = is_potentially_hazardous_asteroid ? 'Yes' : 'No';
  const hazardousClass = is_potentially_hazardous_asteroid
    ? 'text-red-400'
    : 'text-green-400';

  const content = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 class="text-3xl font-bold text-indigo-300 mb-2">${name}</h3>
                        <p class="text-indigo-200 mb-6">Potentially Hazardous: <span class="font-bold ${hazardousClass}">${hazardousText}</span></p>
                        
                        <h4 class="text-xl font-semibold text-indigo-300 mb-4">Physical Characteristics</h4>
                        <div class="grid grid-cols-2 gap-4 text-center">
                            <div class="glass-effect p-4 rounded-lg"><div class="stat-value">${diameter} km</div><div class="stat-label">Max. Diameter</div></div>
                            <div class="glass-effect p-4 rounded-lg"><div class="stat-value">${absolute_magnitude_h}</div><div class="stat-label">Abs. Magnitude (H)</div></div>
                        </div>
                    </div>
                     <div>
                        <h4 class="text-xl font-semibold text-indigo-300 mb-4">Orbital Data</h4>
                        <div class="space-y-3">
                            <div class="flex justify-between p-3 glass-effect rounded-lg"><span class="stat-label">Orbit Class:</span> <span class="font-semibold text-indigo-200">${
                              orbital_data.orbit_class.orbit_class_type
                            }</span></div>
                            <div class="flex justify-between p-3 glass-effect rounded-lg"><span class="stat-label">Eccentricity:</span> <span class="font-semibold text-indigo-200">${parseFloat(
                              orbital_data.eccentricity
                            ).toFixed(4)}</span></div>
                            <div class="flex justify-between p-3 glass-effect rounded-lg"><span class="stat-label">Semi-Major Axis:</span> <span class="font-semibold text-indigo-200">${parseFloat(
                              orbital_data.semi_major_axis
                            ).toFixed(4)} AU</span></div>
                            <div class="flex justify-between p-3 glass-effect rounded-lg"><span class="stat-label">Orbital Period:</span> <span class="font-semibold text-indigo-200">${parseFloat(
                              orbital_data.orbital_period
                            ).toFixed(2)} days</span></div>
                            <div class="flex justify-between p-3 glass-effect rounded-lg"><span class="stat-label">Perihelion:</span> <span class="font-semibold text-indigo-200">${parseFloat(
                              orbital_data.perihelion_distance
                            ).toFixed(4)} AU</span></div>
                            <div class="flex justify-between p-3 glass-effect rounded-lg"><span class="stat-label">Aphelion:</span> <span class="font-semibold text-indigo-200">${parseFloat(
                              orbital_data.aphelion_distance
                            ).toFixed(4)} AU</span></div>
                            <div class="flex justify-between p-3 glass-effect rounded-lg"><span class="stat-label">Inclination:</span> <span class="font-semibold text-indigo-200">${parseFloat(
                              orbital_data.inclination
                            ).toFixed(4)}°</span></div>
                        </div>
                    </div>
                </div>
                <div class="mt-8 text-center">
                     <button id="generate-factsheet-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300">
                        ✨ Generate Fun Factsheet
                    </button>
                </div>
                <div id="factsheet-container" class="mt-6"></div>
            `;
  asteroidInfoContainer.innerHTML = content;
  asteroidInfoContainer.style.display = 'block';

  document
    .getElementById('generate-factsheet-btn')
    .addEventListener('click', () => generateFactsheet(data));
}

async function generateFactsheet(data) {
  const container = document.getElementById('factsheet-container');
  const button = document.getElementById('generate-factsheet-btn');
  button.disabled = true;
  container.innerHTML = `<div class="flex justify-center items-center py-4"><div class="loader"></div></div>`;

  const { name, orbital_data, estimated_diameter } = data;
  const prompt = `You are a science communicator at a planetarium. Take the following technical data about asteroid "${name}" and generate a fun, engaging, and easy-to-understand factsheet in a single paragraph for a general audience. Explain what its orbital class (${
    orbital_data.orbit_class.orbit_class_description
  }) means in simple terms and provide a relatable size comparison for its maximum diameter (${estimated_diameter.kilometers.estimated_diameter_max.toFixed(
    2
  )} km). Data: Orbit Period: ${orbital_data.orbital_period} days.`;

  try {
    const factsheet = await callGeminiAPI(prompt);
    container.innerHTML = `
                    <div class="glass-effect rounded-xl p-6 mt-4 border-l-4 border-purple-400">
                        <h4 class="text-xl font-bold text-purple-300 mb-2">✨ Fun Factsheet</h4>
                        <p class="text-indigo-200 leading-relaxed">${factsheet.replace(
                          /\n/g,
                          '<br>'
                        )}</p>
                    </div>
                `;
  } catch (error) {
    container.innerHTML = `<p class="text-red-400 text-center mt-4">Failed to generate factsheet. Please try again.</p>`;
  } finally {
    button.disabled = false;
  }
}

function displayError(message) {
  errorText.textContent = message;
  errorMessage.style.display = 'block';
  asteroidInfoContainer.style.display = 'none';
}

neoBtn.addEventListener('click', fetchNeos);

async function fetchNeos() {
  neoLoader.style.display = 'flex';
  neoError.style.display = 'none';
  neoListContainer.innerHTML = '';

  const today = new Date();
  const startDateStr = today.toISOString().split('T')[0];

  try {
    const response = await fetch(
      `${BACKEND_ORIGIN}/neo-feed?start_date=${startDateStr}`
    );
    if (!response.ok) {
      let errorMsg = `NASA NeoWs API returned an error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMsg += ` - ${errorData.error.message}`;
        } else if (errorData.error_message) {
          errorMsg += ` - ${errorData.error_message}`;
        }
      } catch (e) {
        errorMsg += ` ${response.statusText}`;
      }
      throw new Error(errorMsg);
    }
    const data = await response.json();
    displayNeos(data.near_earth_objects);
  } catch (error) {
    console.error('Error fetching NEO data:', error);
    displayNeoError(error.message);
  } finally {
    neoLoader.style.display = 'none';
  }
}

function displayNeos(neosByDate) {
  const allNeos = Object.values(neosByDate)
    .flat()
    .sort(
      (a, b) =>
        new Date(a.close_approach_data[0].close_approach_date_full) -
        new Date(b.close_approach_data[0].close_approach_date_full)
    );

  if (allNeos.length === 0) {
    displayNeoError('No Near-Earth Objects found for the upcoming week.');
    return;
  }

  allNeos.forEach((neo) => {
    const isHazardous = neo.is_potentially_hazardous_asteroid;
    const diameterMin =
      neo.estimated_diameter.meters.estimated_diameter_min.toFixed(2);
    const diameterMax =
      neo.estimated_diameter.meters.estimated_diameter_max.toFixed(0); // Use integer for URL
    const closestApproach = neo.close_approach_data[0];
    const velocityKms = parseFloat(
      closestApproach.relative_velocity.kilometers_per_second
    ).toFixed(2);

    const simulatorUrl = `https://simulator.down2earth.eu/results.html?lang=en&planet=Earth&dist=100&diam=${diameterMax}&traj=45&velo=${velocityKms}&pjd=2&tjd=i&wlvl=0`;

    const card = document.createElement('div');
    card.className = `glass-effect rounded-2xl p-5 border-l-4 ${
      isHazardous ? 'border-red-500' : 'border-green-500'
    } flex flex-col`;

    card.innerHTML = `
                    <div>
                        <h4 class="text-xl font-bold truncate ${
                          isHazardous ? 'text-red-300' : 'text-green-300'
                        }">${neo.name}</h4>
                        ${
                          isHazardous
                            ? '<div class="text-sm font-semibold text-red-400 mb-2">Potentially Hazardous</div>'
                            : '<div class="text-sm font-semibold text-green-400 mb-2">Not Hazardous</div>'
                        }
                        <div class="text-sm text-indigo-200 mt-2 space-y-1">
                            <p><strong>SPK-ID:</strong> ${neo.id}</p>
                            <p><strong>Diameter:</strong> ${diameterMin} - ${neo.estimated_diameter.meters.estimated_diameter_max.toFixed(
      2
    )} m</p>
                            <p><strong>Closest Approach:</strong> ${new Date(
                              closestApproach.close_approach_date_full
                            ).toLocaleString()}</p>
                            <p><strong>Velocity:</strong> ${velocityKms} km/s</p>
                            <p><strong>Miss Distance:</strong> ${parseFloat(
                              closestApproach.miss_distance.kilometers
                            ).toLocaleString()} km</p>
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-white/10" id="gemini-neo-container-${
                      neo.id
                    }">
                        ${
                          isHazardous
                            ? `
                        <div class="flex flex-col sm:flex-row gap-2">
                            <button id="assess-impact-btn-${neo.id}" class="flex-1 bg-red-800/50 hover:bg-red-700/50 text-white text-sm font-bold py-2 px-4 rounded-lg transition duration-300">✨ Assess Impact</button>
                            <a href="${simulatorUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 bg-blue-800/50 hover:bg-blue-700/50 text-white text-sm font-bold py-2 px-4 rounded-lg transition duration-300 text-center">🛰️ Simulate Impact</a>
                        </div>
                        `
                            : ''
                        }
                    </div>
                `;
    neoListContainer.appendChild(card);

    if (isHazardous) {
      document
        .getElementById(`assess-impact-btn-${neo.id}`)
        .addEventListener('click', () => assessImpact(neo));
    }
  });
}

async function assessImpact(neo) {
  const container = document.getElementById(`gemini-neo-container-${neo.id}`);
  const closestApproach = neo.close_approach_data[0];
  const originalContent = container.innerHTML; // Save original buttons
  container.innerHTML = `<div class="flex justify-center items-center"><div class="gemini-loader"></div></div>`;

  const prompt = `Analyze the following data for a potentially hazardous asteroid named "${
    neo.name
  }". In a concise, single paragraph, explain the potential threat level in layman's terms. Emphasize the vastness of the miss distance (${parseFloat(
    closestApproach.miss_distance.kilometers
  ).toLocaleString()} km) to provide context and prevent alarmism. Also, explain why an object with such a large miss distance is still classified as 'potentially hazardous'. Data: Diameter: ${neo.estimated_diameter.meters.estimated_diameter_min.toFixed(
    2
  )} - ${neo.estimated_diameter.meters.estimated_diameter_max.toFixed(
    2
  )} meters, Velocity: ${parseFloat(
    closestApproach.relative_velocity.kilometers_per_second
  ).toFixed(2)} km/s.`;

  try {
    const assessment = await callGeminiAPI(prompt);
    container.innerHTML = `
                    <h5 class="text-base font-bold text-red-300 mb-1">✨ Impact Assessment</h5>
                    <p class="text-sm text-indigo-200 leading-relaxed">${assessment}</p>
                `;
  } catch (error) {
    container.innerHTML = `<p class="text-red-400 text-center text-sm">Failed to generate assessment.</p>`;
    // Restore buttons on failure
    setTimeout(() => {
      container.innerHTML = originalContent;
    }, 3000);
  }
}

function displayNeoError(message) {
  neoErrorText.textContent = message;
  neoError.style.display = 'block';
}
