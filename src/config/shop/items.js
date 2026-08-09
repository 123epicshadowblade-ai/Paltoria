export const shopItems = [
    {
        id: 'supporter_5',
        name: '⭐ Server Supporter - $5 Tier',
        price: 5,
        description: 'Real-money purchase via Ko-fi (not in-game cash). Grants the permanent Server Supporter role.',
        type: 'real_money',
        currency: 'USD'
    },
    {
        id: 'supporter_10',
        name: '⭐ Server Supporter - $10 Tier',
        price: 10,
        description: 'Real-money purchase via Ko-fi (not in-game cash). Grants the permanent Server Supporter role.',
        type: 'real_money',
        currency: 'USD'
    },
    {
        id: 'supporter_15',
        name: '⭐ Server Supporter - $15 Tier',
        price: 15,
        description: 'Real-money purchase via Ko-fi (not in-game cash). Grants the permanent Server Supporter role.',
        type: 'real_money',
        currency: 'USD'
    },
    {
        id: 'supporter_20',
        name: '⭐ Server Supporter - $20 Tier',
        price: 20,
        description: 'Real-money purchase via Ko-fi (not in-game cash). Grants the permanent Server Supporter role.',
        type: 'real_money',
        currency: 'USD'
    }
];

export function getItemById(itemId) {
    return shopItems.find(item => item.id === itemId);
}

export function getItemsByType(type) {
    return shopItems.filter(item => item.type === type);
}

export function getItemPrice(itemId) {
    const item = getItemById(itemId);
    return item ? item.price : 0;
}
