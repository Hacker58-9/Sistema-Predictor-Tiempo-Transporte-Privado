// scriptAuth.js

document.addEventListener('DOMContentLoaded', () => {
    
    // === LOGIN ===
    const loginForm = document.getElementById('login-form');
    
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        // Aquí iría tu lógica de autenticación (por ahora simulamos)
        if (email && password) {
            // Simulación de login exitoso
            console.log('Login exitoso');
            
            // Redirección a la página principal
            window.location.href = 'index.html';
        } else {
            alert('Por favor completa todos los campos');
        }
    });

    // === SWITCH ENTRE LOGIN Y REGISTER ===
    document.getElementById('show-register').addEventListener('click', () => {
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('register-form-container').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', () => {
        document.getElementById('register-form-container').classList.add('hidden');
        document.getElementById('login-form-container').classList.remove('hidden');
    });

    // (Opcional) También puedes hacer la redirección después del registro
});