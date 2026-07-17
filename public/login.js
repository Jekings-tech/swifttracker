document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const errorMessage = document.getElementById('errorMessage');
    const rememberMe = document.getElementById('rememberMe');

    // Check if already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        window.location.href = '/dashboard.html';
        return;
    }

    // Toggle password visibility
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.querySelector('i').classList.toggle('fa-eye');
        togglePassword.querySelector('i').classList.toggle('fa-eye-slash');
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        // Validate input
        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }

        // Disable button and show loading state
        const submitBtn = loginForm.querySelector('.login-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Signing in...</span><i class="fas fa-spinner fa-spin"></i>';
        hideError();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Store token
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                if (rememberMe.checked) {
                    localStorage.setItem('rememberUsername', username);
                } else {
                    localStorage.removeItem('rememberUsername');
                }

                // Redirect to dashboard
                window.location.href = '/dashboard.html';
            } else {
                showError(data.error || 'Invalid credentials. Please try again.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please check your connection.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
        }
    });

    // Show error message
    function showError(message) {
        errorMessage.style.display = 'flex';
        errorMessage.querySelector('span').textContent = message;
        // Auto-hide after 5 seconds
        clearTimeout(errorMessage.timeout);
        errorMessage.timeout = setTimeout(() => {
            hideError();
        }, 5000);
    }

    // Hide error message
    function hideError() {
        errorMessage.style.display = 'none';
    }

    // Auto-fill saved username
    const savedUsername = localStorage.getItem('rememberUsername');
    if (savedUsername) {
        usernameInput.value = savedUsername;
        rememberMe.checked = true;
    }

    // Add input focus effects
    document.querySelectorAll('.form-group input').forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.parentElement.querySelector('label').style.color = '#667eea';
        });
        input.addEventListener('blur', function() {
            this.parentElement.parentElement.querySelector('label').style.color = '#2d3748';
        });
    });
});