async function loadPortalData() {
  const pageCategory = document.body.dataset.category;
  if (!pageCategory) return;

  try {
    const response = await fetch('./data/dalkhola.json');
    const data = await response.json();

    const container = document.getElementById('content-list');
    if (!container) return;
    container.innerHTML = '';

    if (pageCategory === 'home') {
      document.getElementById('last-updated').textContent = new Date(data.metadata.last_updated).toLocaleDateString();
      document.getElementById('district-info').textContent = `${data.metadata.district}, ${data.metadata.state}`;
    } 
    else if (pageCategory === 'business') {
      data.business.directory.forEach(biz => {
        container.innerHTML += `
          <div class="card">
            <h3>${biz.name}</h3>
            <p><strong>Category:</strong> ${biz.category}</p>
            <p><strong>Location/Hub:</strong> ${biz.area}</p>
          </div>`;
      });
    } 
    else if (pageCategory === 'education') {
      data.education.colleges.forEach(col => {
        container.innerHTML += `
          <div class="card">
            <h3>${col.name}</h3>
            <p><strong>Type:</strong> ${col.type}</p>
            <p><strong>Affiliation:</strong> ${col.affiliated_to}</p>
          </div>`;
      });
      data.education.schools.forEach(sch => {
        container.innerHTML += `
          <div class="card">
            <h3>${sch.name}</h3>
            <p><strong>Level:</strong> ${sch.type}</p>
            <p><strong>Medium:</strong> ${sch.medium}</p>
          </div>`;
      });
    } 
    else if (pageCategory === 'services') {
      data.services.healthcare.forEach(h => {
        container.innerHTML += `
          <div class="card">
            <h3>${h.name}</h3>
            <p><strong>Category:</strong> ${h.type}</p>
            <p><strong>Info:</strong> ${h.contact}</p>
          </div>`;
      });
      data.services.civic_and_banking.forEach(s => {
        container.innerHTML += `
          <div class="card">
            <h3>${s.name}</h3>
            <p><strong>Category:</strong> ${s.type}</p>
          </div>`;
      });
    }
    else if (pageCategory === 'transport') {
      container.innerHTML += `
        <div class="card">
          <h3>🚂 Railway Junction</h3>
          <p><strong>Station:</strong> ${data.transport.railway.station} (${data.transport.railway.code})</p>
          <p><strong>Zone:</strong> ${data.transport.railway.zone}</p>
        </div>`;
      data.transport.highways.forEach(hw => {
        container.innerHTML += `
          <div class="card">
            <h3>🚦 ${hw.name} Corridor</h3>
            <p>${hw.description}</p>
          </div>`;
      });
    }

  } catch (err) {
    console.error('Failed to load JSON data:', err);
  }
}

document.addEventListener("DOMContentLoaded", loadPortalData);
