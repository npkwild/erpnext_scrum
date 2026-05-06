frappe.ready(function() {
    if (window.location.pathname === '/login') {
        // Find the login form or the social login section
        const loginForm = document.querySelector('.for-login');
        if (loginForm && !document.querySelector('.scrum-login-btn')) {
            const scrumBtnContainer = document.createElement('div');
            scrumBtnContainer.className = 'scrum-login-btn mt-4 pt-4 border-top text-center';
            scrumBtnContainer.innerHTML = `
                <p class="text-muted small mb-3">Looking for the Scrum Board?</p>
                <a href="/scrum_login" class="btn btn-outline-secondary btn-sm btn-block" 
                   style="border-radius: 12px; padding: 12px; font-weight: 600; transition: all 0.2s; background: #f8fafc; border-color: #e2e8f0; color: #1e293b;">
                   <svg class="icon icon-sm mr-2" style="vertical-align: middle; width: 16px; height: 16px; fill: currentColor;">
                       <use href="#icon-calendar"></use>
                   </svg>
                   Go to Daily Scrum
                </a>
            `;
            loginForm.appendChild(scrumBtnContainer);
        }
    }
});
