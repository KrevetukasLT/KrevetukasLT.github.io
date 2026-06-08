// held together by hopes and prayers 

const Cart = {
    get() {
        try {
            return JSON.parse(localStorage.getItem('cart')) || [];
        } catch {
            return [];
        }
    },
    save(cart) {
        localStorage.setItem('cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cart-updated'));
    },
    add(id, name, price) {
        const cart = this.get();
        const item = cart.find(i => i.id === id);
        if (item) {
            item.quantity++;
        } else {
            cart.push({ id, name, price, quantity: 1 });
        }
        this.save(cart);
    },
    updateQuantity(id, quantity) {
        let cart = this.get();
        const item = cart.find(i => i.id === id);
        if (!item) return;

        item.quantity = quantity;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id !== id);
        }
        this.save(cart);
    },
    remove(id) {
        this.save(this.get().filter(i => i.id !== id));
    }
};

function updateCartButtons() {
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        if (btn.dataset.timeoutId) return;

        const id = btn.dataset.id;
        if (!id) return;

        const cart = Cart.get();
        const item = cart.find(i => i.id === id);
        const qty = item ? item.quantity : 0;

        if (qty > 0) {
            btn.textContent = `Į krepšelį (${qty})`;
        } else {
            btn.textContent = 'Į krepšelį';
        }
    });
}

window.addEventListener('storage', (e) => {
    if (e.key === 'cart') {
        window.dispatchEvent(new Event('cart-updated'));
    }
});

window.addEventListener('cart-updated', updateCartButtons);
document.body.addEventListener('spa-reload', updateCartButtons);

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn || btn.disabled) return;

    const id = btn.dataset.id;
    const name = btn.dataset.name;

    const priceEl = document.getElementById(id);
    if (!priceEl || !priceEl.dataset.price) return;

    const price = parseFloat(priceEl.dataset.price);
    Cart.add(id, name, price);

    const cart = Cart.get();
    const item = cart.find(i => i.id === id);
    const qty = item ? item.quantity : 1;

    if (btn.dataset.timeoutId) {
        clearTimeout(parseInt(btn.dataset.timeoutId, 10));
    } else {
        btn.style.width = btn.offsetWidth + 'px';
    }

    btn.textContent = `Pridėta (${qty})`;

    const timeoutId = setTimeout(() => {
        delete btn.dataset.timeoutId;
        btn.style.width = '';
        updateCartButtons();
    }, 1500);

    btn.dataset.timeoutId = timeoutId.toString();
});

window.Cart = Cart;