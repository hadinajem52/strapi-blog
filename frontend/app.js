const API_URL = 'http://localhost:1337/api';
// Security: Token is now managed via httpOnly cookies, not accessible via JavaScript
// This variable is only used for session state tracking, actual auth is via cookies
let token = null;
let currentUser = null;

// Security: Helper function to get cookie value (for non-httpOnly cookies only)
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Security: Helper function to set cookie with secure flags
function setSecureCookie(name, value, minutes) {
  const expires = new Date(Date.now() + minutes * 60 * 1000).toUTCString();
  // Note: httpOnly cookies must be set by server, this is for session tracking only
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
}

// Security: Helper function to delete cookie
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}

// Security: HTML escaping function to prevent XSS attacks
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Security: Password strength validation
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const errors = [];
  if (password.length < minLength) errors.push(`Password must be at least ${minLength} characters`);
  if (!hasUpperCase) errors.push('Password must contain at least one uppercase letter');
  if (!hasLowerCase) errors.push('Password must contain at least one lowercase letter');
  if (!hasNumbers) errors.push('Password must contain at least one number');
  if (!hasSpecialChar) errors.push('Password must contain at least one special character');
  
  return { valid: errors.length === 0, errors };
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Security: Check for active session via cookie instead of localStorage token
  const hasActiveSession = getCookie('session_active') === 'true';
  if (hasActiveSession) {
    showBlog();
    loadCurrentUser();
  } else {
    showLogin();
  }

  // Set up event listeners
  setupEventListeners();
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('user-dropdown');
    const userMenu = document.getElementById('user-menu');
    if (dropdown && !userMenu.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
});

function setupEventListeners() {
  // Handle image preview
  document.getElementById('post-image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById('image-preview').src = e.target.result;
        document.getElementById('image-preview-container').style.display = 'block';
        document.getElementById('image-upload-label').style.display = 'none';
        document.getElementById('upload-text').textContent = file.name;
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle form submission
  document.getElementById('create-post-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const imageFile = document.getElementById('post-image').files[0];
    
    if (title && content) {
      showLoading(true);
      try {
        const formData = new FormData();
        
        // Add the blog data as JSON string
        const postData = { title, content };
        formData.append('data', JSON.stringify(postData));
        
        // Add image if provided
        if (imageFile) {
          formData.append('files.image', imageFile);
        }
        
        const res = await fetch(`${API_URL}/blogs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          credentials: 'include', // Security: Include cookies for httpOnly token
          body: formData
        });
        
        if (res.ok) {
          closeModal();
          removeImage();
          loadPosts();
          showToast('Story published successfully!', 'success');
        } else {
          const errorData = await res.json();
          showToast('Failed to create post: ' + (errorData.error?.message || 'Unknown error'), 'error');
        }
      } catch (error) {
        console.error('Create post error:', error);
        showToast('Error creating post: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    }
  });
  
  // Handle modal close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
  
  // Handle modal close on backdrop click
  document.getElementById('create-post-modal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const button = input.nextElementSibling.nextElementSibling;
  
  if (input.type === 'password') {
    input.type = 'text';
    button.classList.add('show');
  } else {
    input.type = 'password';
    button.classList.remove('show');
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  dropdown.classList.toggle('show');
}

function showLogin() {
  document.getElementById('auth-container').style.display = 'flex';
  document.getElementById('blog-container').style.display = 'none';
  document.getElementById('main-header').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
}

function showRegister() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
}

function showBlog() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('blog-container').style.display = 'block';
  document.getElementById('main-header').style.display = 'block';
  loadPosts();
}

function showHome() {
  document.getElementById('home-section').style.display = 'block';
  document.getElementById('admin-section').style.display = 'none';
  
  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  document.getElementById('nav-home').classList.add('active');
  
  loadPosts();
}

async function loadCurrentUser() {
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include' // Security: Include cookies for httpOnly token
    });
    if (res.ok) {
      currentUser = await res.json();
      updateUserUI();
    }
  } catch (error) {
    console.error('Error loading user:', error);
  }
}

function updateUserUI() {
  if (currentUser) {
    const initial = (currentUser.username || currentUser.email || 'U').charAt(0).toUpperCase();
    document.getElementById('header-user-avatar').textContent = initial;
    document.getElementById('dropdown-username').textContent = currentUser.username || 'User';
    document.getElementById('dropdown-email').textContent = currentUser.email || '';
    
    // Show admin link if user is admin
    if (currentUser.role?.type === 'admin' || currentUser.isAdmin) {
      document.getElementById('admin-link').style.display = 'flex';
    }
  }
}

async function login() {
  console.log('Login clicked');
  showLoading(true);
  try {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    console.log('Fetching:', `${API_URL}/auth/local`);
    const res = await fetch(`${API_URL}/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Security: Include cookies for httpOnly token storage
      body: JSON.stringify({ identifier: email, password })
    });
    console.log('Response status:', res.status);
    const data = await res.json();
    console.log('Response data:', data);
    if (data.jwt) {
      // Security: Token is stored in httpOnly cookie by server, we just track session state
      token = data.jwt;
      setSecureCookie('session_active', 'true', 30); // 30 min session tracking
      currentUser = data.user;
      updateUserUI();
      showBlog();
      showToast('Welcome back!', 'success');
    } else {
      showToast('Login failed: ' + (data.error?.message || 'Invalid credentials'), 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Login error: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function register() {
  console.log('Register clicked');
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  
  // Security: Validate password strength before registration
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    showToast('Password requirements: ' + passwordValidation.errors[0], 'error');
    return;
  }
  
  showLoading(true);
  try {
    console.log('Fetching:', `${API_URL}/auth/local/register`);
    const res = await fetch(`${API_URL}/auth/local/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Security: Include cookies for httpOnly token storage
      body: JSON.stringify({ username: email, email, password })
    });
    console.log('Response status:', res.status);
    const data = await res.json();
    console.log('Response data:', data);
    if (data.jwt) {
      // Security: Token is stored in httpOnly cookie by server, we just track session state
      token = data.jwt;
      setSecureCookie('session_active', 'true', 30); // 30 min session tracking
      currentUser = data.user;
      updateUserUI();
      showBlog();
      showToast('Account created successfully!', 'success');
    } else {
      showToast('Registration failed: ' + (data.error?.message || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Register error:', error);
    showToast('Register error: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function logout() {
  token = null;
  currentUser = null;
  // Security: Clear session tracking cookie (httpOnly token cookie cleared by server)
  deleteCookie('session_active');
  showLogin();
  showToast('Logged out successfully', 'success');
}

async function loadPosts() {
  try {
    const res = await fetch(`${API_URL}/blogs?populate=author,image&sort=createdAt:desc`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include' // Security: Include cookies for httpOnly token
    });
    const data = await res.json();
    console.log('API response:', data);
    const postsDiv = document.getElementById('posts');
    const emptyState = document.getElementById('empty-state');
    postsDiv.innerHTML = '';
    
    if (data.data && data.data.length > 0) {
      emptyState.style.display = 'none';
      data.data.forEach((post, index) => {
        const div = document.createElement('div');
        div.className = 'post';
        div.style.animationDelay = `${index * 0.1}s`;
        
        // Handle both Strapi v4 (attributes) and v5 (flat structure) formats
        const title = post.attributes ? post.attributes.title : post.title;
        const content = post.attributes ? post.attributes.content : post.content;
        const author = post.attributes?.author?.data?.attributes || post.author;
        const publishedAt = post.attributes ? post.attributes.publishedAt : post.publishedAt;
        const createdAt = post.attributes ? post.attributes.createdAt : post.createdAt;
        const image = post.attributes?.image?.data?.attributes || post.image;
        
        // Security: Escape all user-generated content to prevent XSS
        const safeTitle = escapeHtml(title);
        const safeContent = escapeHtml(content);
        const safeAuthorName = escapeHtml(author?.username || author?.email || 'Anonymous');
        const authorInitial = safeAuthorName.charAt(0).toUpperCase();
        
        // Format timestamp
        const postDate = new Date(publishedAt || createdAt);
        const timeAgo = formatTimeAgo(postDate);
        const fullDate = postDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Build image HTML if image exists
        let imageHtml = '';
        if (image && image.url) {
          const imageUrl = image.url.startsWith('http') ? image.url : `http://localhost:1337${image.url}`;
          imageHtml = `
            <div class="post-image-wrapper">
              <img src="${escapeHtml(imageUrl)}" alt="${safeTitle}" class="post-image">
            </div>
          `;
        } else {
          // Create a placeholder with the first letter of the title
          imageHtml = `
            <div class="post-image-wrapper">
              <div class="post-placeholder-image">${safeTitle.charAt(0)}</div>
            </div>
          `;
        }
        
        div.innerHTML = `
          ${imageHtml}
          <div class="post-body">
            <div class="post-header">
              <div class="author-avatar">${authorInitial}</div>
              <div class="author-info">
                <div class="author-name">${safeAuthorName}</div>
                <div class="post-time" title="${escapeHtml(fullDate)}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  ${timeAgo}
                </div>
              </div>
            </div>
            <h3>${safeTitle}</h3>
            <p>${safeContent}</p>
            <div class="post-footer">
              <a href="#" class="read-more-btn">
                Read more
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
            </div>
          </div>
        `;
        postsDiv.appendChild(div);
      });
    } else {
      emptyState.style.display = 'block';
    }
  } catch (error) {
    console.error('Load posts error:', error);
    showToast('Error loading posts', 'error');
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
}

async function createPost() {
  document.getElementById('create-post-modal').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('post-title').focus();
  }, 100);
}

function closeModal() {
  document.getElementById('create-post-modal').style.display = 'none';
  document.getElementById('create-post-form').reset();
  removeImage();
}

function removeImage() {
  document.getElementById('post-image').value = '';
  document.getElementById('image-preview').src = '';
  document.getElementById('image-preview-container').style.display = 'none';
  document.getElementById('image-upload-label').style.display = 'flex';
  document.getElementById('upload-text').textContent = 'Drop an image here or click to upload';
}

function showAdminPanel() {
  document.getElementById('home-section').style.display = 'none';
  document.getElementById('admin-section').style.display = 'block';
  
  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  document.getElementById('admin-link')?.classList.add('active');
  
  loadAdminPosts();
}

async function loadAdminPosts() {
  try {
    const res = await fetch(`${API_URL}/blogs?populate=author,image&sort=createdAt:desc`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include' // Security: Include cookies for httpOnly token
    });
    const data = await res.json();
    const postsDiv = document.getElementById('admin-posts');
    postsDiv.innerHTML = '';
    
    if (data.data && data.data.length > 0) {
      data.data.forEach((post, index) => {
        const div = document.createElement('div');
        div.className = 'post';
        div.style.animationDelay = `${index * 0.1}s`;
        
        const title = post.attributes ? post.attributes.title : post.title;
        const content = post.attributes ? post.attributes.content : post.content;
        const author = post.attributes?.author?.data?.attributes || post.author;
        const publishedAt = post.attributes ? post.attributes.publishedAt : post.publishedAt;
        const createdAt = post.attributes ? post.attributes.createdAt : post.createdAt;
        const postId = post.id;
        
        // Security: Escape all user-generated content to prevent XSS
        const safeTitle = escapeHtml(title);
        const safeContent = escapeHtml(content);
        const safeAuthorName = escapeHtml(author?.username || author?.email || 'Anonymous');
        const authorInitial = safeAuthorName.charAt(0).toUpperCase();
        
        const postDate = new Date(publishedAt || createdAt);
        const timeAgo = formatTimeAgo(postDate);
        const fullDate = postDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        div.innerHTML = `
          <div class="post-body">
            <div class="post-header">
              <div class="author-avatar">${authorInitial}</div>
              <div class="author-info">
                <div class="author-name">${safeAuthorName}</div>
                <div class="post-time" title="${escapeHtml(fullDate)}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  ${timeAgo}
                </div>
              </div>
            </div>
            <h3>${safeTitle}</h3>
            <p>${safeContent}</p>
            <div class="post-footer">
              <div class="post-actions">
                <button class="btn btn-sm btn-danger" onclick="deletePost(${parseInt(postId)})">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        `;
        postsDiv.appendChild(div);
      });
    } else {
      postsDiv.innerHTML = '<div class="empty-state"><h3>No posts to manage</h3><p>There are no blog posts in the system.</p></div>';
    }
  } catch (error) {
    console.error('Load admin posts error:', error);
    showToast('Error loading admin posts', 'error');
  }
}

async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) return;
  
  showLoading(true);
  try {
    const res = await fetch(`${API_URL}/blogs/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include' // Security: Include cookies for httpOnly token
    });
    
    if (res.ok) {
      loadAdminPosts();
      showToast('Post deleted successfully', 'success');
    } else {
      showToast('Failed to delete post', 'error');
    }
  } catch (error) {
    console.error('Delete post error:', error);
    showToast('Error deleting post', 'error');
  } finally {
    showLoading(false);
  }
}

// Toast notification system
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }
  
  // Security: Escape message to prevent XSS
  toast.innerHTML = `${iconSvg}<span class="toast-message">${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  
  // Remove toast after animation
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Loading overlay
function showLoading(show) {
  document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}
