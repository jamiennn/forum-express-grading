const assert = require('assert')
const { Restaurant, Category, Comment, User } = require('../models')
const { getOffset, getPagination } = require('../helpers/pagination-helpers')

const restaurantController = {
  getRestaurants: (req, res, next) => {
    const DEFAULT_LIMIT = 9

    const categoryId = Number(req.query.categoryId) || ''
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || DEFAULT_LIMIT
    const offset = getOffset(limit, page)

    return Promise.all([
      Restaurant.findAndCountAll({
        include: [Category],
        where: {
          ...categoryId ? { categoryId } : {}
        },
        offset,
        limit,
        raw: true,
        nest: true
      }),
      Category.findAll({
        where: { deleted: 0 },
        raw: true
      })
    ])
      .then(([restaurants, categories]) => {
        const favoritedRestaurantIds = req.user && req.user.FavoritedRestaurants.map(fr => fr.id)
        const likedRestaurantIds = req.user && req.user.LikedRestaurants.map(lr => lr.id)

        const data = restaurants.rows
          .map(r => ({
            ...r,
            description: r.description.substring(0, 50),
            isFavorited: favoritedRestaurantIds.includes(r.id),
            isLiked: likedRestaurantIds.includes(r.id)
          }))
        data.forEach(r => {
          if (r.Category.deleted) r.Category.name = '未分類'
        })

        return res.render('restaurants', {
          restaurants: data,
          categories,
          categoryId,
          pagination: getPagination(limit, page, restaurants.count)
        })
      })
      .catch(err => next(err))
  },
  getRestaurant: (req, res, next) => {
    return Restaurant.findByPk(req.params.id, {
      include: [
        Category,
        { model: Comment, include: User },
        { model: User, as: 'FavoritedUsers' },
        { model: User, as: 'LikedUsers' }
      ],
      order: [[Comment, 'createdAt', 'DESC']]
    })
      .then(restaurant => {
        assert(restaurant, 'Restaurant does not exist!')
        return restaurant.increment('viewCounts')
      })
      .then(restaurant => {
        const isFavorited = restaurant.FavoritedUsers.some(f => f.id === req.user.id)
        const isLiked = restaurant.LikedUsers.some(l => l.id === req.user.id)

        restaurant = restaurant.toJSON()
        if (restaurant.Category.deleted) restaurant.Category.name = '未分類'

        res.render('restaurant', { restaurant, isFavorited, isLiked })
      })
      .catch(err => next(err))
  },
  getDashboard: (req, res, next) => {
    return Restaurant.findByPk(req.params.id, {
      include: [
        Category,
        Comment,
        { model: User, as: 'FavoritedUsers' }
      ]
    })
      .then(restaurant => {
        assert(restaurant, 'Restaurant does not exist!')
        if (restaurant.Category.deleted) restaurant.Category.name = '未分類'
        res.render('dashboard', { restaurant: restaurant.toJSON() })
      })
      .catch(err => next(err))
  },
  getFeeds: (req, res, next) => {
    return Promise.all([
      Restaurant.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [Category],
        raw: true,
        nest: true
      }),
      Comment.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [Restaurant, User],
        raw: true,
        nest: true
      })
    ])
      .then(([restaurants, comments]) => {
        restaurants.forEach(r => {
          if (r.Category.deleted) r.Category.name = '未分類'
        })
        res.render('feeds', { restaurants, comments })
      })
      .catch(err => next(err))
  },
  getTopRestaurants: (req, res, next) => {
    Restaurant.findAll({
      include: [
        { model: User, as: 'FavoritedUsers' }
      ]
    })
      .then(restaurants => {
        restaurants = restaurants
          .map(restaurant => ({
            ...restaurant.toJSON(),
            favoritedCount: restaurant.FavoritedUsers.length,
            isFavorited: req.user && restaurant.FavoritedUsers.some(f => f.id === req.user.id)
          }))
          .sort((a, b) => b.favoritedCount - a.favoritedCount)
          .slice(0, 10)
        res.render('top-restaurants', { restaurants })
      })
      .catch(err => next(err))
  }
}

module.exports = restaurantController
