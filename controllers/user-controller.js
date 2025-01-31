const bcrypt = require('bcryptjs')
const assert = require('assert')
const db = require('../models')
const { imgurFileHelper } = require('../helpers/file-helpers')
const { User, Comment, Restaurant, Favorite, Like, Followship } = db

const userController = {
  signUpPage: (req, res) => {
    res.render('signup')
  },
  signUp: (req, res, next) => {
    const { name, email, password, passwordCheck } = req.body
    assert.deepStrictEqual(password, passwordCheck, 'Passwords do not match!')

    User.findOne({ where: { email } })
      .then(user => {
        assert(!user, 'Email already exists!')
        return bcrypt.hash(password, 10)
      })
      .then(hash => User.create({
        name,
        email,
        password: hash
      }))
      .then(() => {
        req.flash('success_messages', '成功註冊帳號!')
        res.redirect('/signin')
      })
      .catch(err => next(err))
  },
  signInPage: (req, res) => {
    res.render('signin')
  },
  signIn: (req, res) => {
    req.flash('success_messages', '成功登入！')
    res.redirect('/restaurants')
  },
  logout: (req, res) => {
    req.flash('success_messages', '登出成功！')
    req.logout()
    res.redirect('/signin')
  },
  getUser: (req, res, next) => {
    const userId = req.params.id

    return Promise.all([
      User.findByPk(userId, {
        include: [
          { model: User, as: 'Followers', attributes: ['id', 'image', 'name'] },
          { model: User, as: 'Followings', attributes: ['id', 'image', 'name'] },
          { model: Restaurant, as: 'FavoritedRestaurants', attributes: ['id', 'image'] }
        ]
      }),
      Comment.findAll({
        where: {
          userId
        },
        raw: true,
        nest: true,
        include: [
          { model: Restaurant, attributes: ['id', 'image'] }
        ]
      })
    ])
      .then(([user, comments]) => {
        assert(user, "User doesn't exists.")
        user = user.toJSON()

        // 取出名字的第一個字元，作為沒有頭貼的替代字
        user = ({
          ...user,
          Followings: user.Followings.map(f => ({
            ...f,
            icon: f.name.slice(0, 1)
          })),
          Followers: user.Followers.map(f => ({
            ...f,
            icon: f.name.slice(0, 1)
          }))
        })

        const set = new Set()
        comments = comments.filter(c => {
          return !set.has(c.restaurantId) ? set.add(c.restaurantId) : false
        })

        res.render('users/profile', { user, comments })
      })
      .catch(err => next(err))
  },
  editUser: (req, res, next) => {
    return User.findByPk(req.params.id, { raw: true })
      .then(user => {
        assert(user, "User doesn't exists.")
        res.render('users/edit', { user })
      })
      .catch(err => next(err))
  },
  putUser: (req, res, next) => {
    const { name } = req.body

    assert(name, 'Name is required.')
    assert.deepStrictEqual(req.user.id, Number(req.params.id), 'You cant edit others profile.')

    return Promise.all([
      User.findByPk(req.params.id),
      imgurFileHelper(req.file)
    ])
      .then(([user, filePath]) => {
        return user.update({
          name,
          image: filePath || user.image
        })
      })
      .then(() => {
        req.flash('success_messages', '使用者資料編輯成功')
        res.redirect(`/users/${req.params.id}`)
      })
      .catch(err => next(err))
  },
  addFavorite: (req, res, next) => {
    const { restaurantId } = req.params
    const userId = req.user.id

    return Promise.all([
      Restaurant.findByPk(restaurantId),
      Favorite.findOne({
        where: {
          restaurantId,
          userId
        }
      })
    ])
      .then(([restaurant, favorite]) => {
        assert(restaurant, "Restaurant didn't exist!")
        assert(!favorite, 'You have favorited this restaurant!')

        return Favorite.create({
          restaurantId,
          userId
        })
      })
      .then(() => Restaurant.findAll({
        include: [
          { model: User, as: 'FavoritedUsers' }
        ]
      }))
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
  },
  removeFavorite: (req, res, next) => {
    return Favorite.findOne({
      where: {
        userId: req.user.id,
        restaurantId: req.params.restaurantId
      }
    })
      .then(favorite => {
        assert(favorite, "You haven't favorited this restaurant")

        return favorite.destroy()
      })
      .then(() => Restaurant.findAll({
        include: [
          { model: User, as: 'FavoritedUsers' }
        ]
      }))
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
  },
  addLike: (req, res, next) => {
    const { restaurantId } = req.params
    const userId = req.user.id

    return Promise.all([
      Restaurant.findByPk(restaurantId),
      Like.findOne({ where: { restaurantId, userId } })
    ])
      .then(([restaurant, like]) => {
        assert(restaurant, "Restaurant didn't exist!")
        assert(!like, 'You have favorited this restaurant!')

        return Like.create({ restaurantId, userId })
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  removeLike: (req, res, next) => {
    const { restaurantId } = req.params
    const userId = req.user.id

    return Like.findOne({ where: { restaurantId, userId } })
      .then(like => {
        assert(like, "You haven't favorited this restaurant")
        return like.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  getTopUsers: (req, res, next) => {
    return User.findAll({
      include: [
        { model: User, as: 'Followers' }
      ]
    })
      .then(users => {
        const result = users
          .map(user => ({
            ...user.toJSON(),
            followerCount: user.Followers.length,
            isFollowed: req.user.Followings.some(f => f.id === user.id)
          }))
          .sort((a, b) => b.followerCount - a.followerCount)
        res.render('top-users', { users: result })
      })
      .catch(err => next(err))
  },
  addFollowing: (req, res, next) => {
    const { userId } = req.params
    const loginUserId = req.user.id

    return Promise.all([
      User.findByPk(userId),
      Followship.findOne({
        where: {
          followerId: loginUserId,
          followingId: userId
        }
      })
    ])
      .then(([user, followship]) => {
        assert(user, "User didn't exist!")
        assert(!followship, 'You are already following this user!')

        return Followship.create({
          followerId: loginUserId,
          followingId: userId
        })
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  removeFollowing: (req, res, next) => {
    return Followship.findOne({
      where: {
        followerId: req.user.id,
        followingId: req.params.userId
      }
    })
      .then(followship => {
        assert(followship, "You haven't followed this user!")
        return followship.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  }
}

module.exports = userController
