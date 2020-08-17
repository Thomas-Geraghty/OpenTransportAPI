import { Router } from "express";
import { ot_database as DB } from '@Data/postgres';
import { ErrorHandler } from '@Helpers/ErrorHandler';
import * as bcrypt from 'bcrypt';
import * as jwt from "jsonwebtoken";
import format = require("pg-format");

export const authRoutes = Router();

type User = {
    user_id: string,
    username: string,
    email: string,
    register_date: string,
    hash?: string
}

export class AuthController {
    static postSignup = async(req, res, next) => {
        const { username, password, email } = req.body;

        // username min length 3
        if (!username || username.length < 5) {
            next(new ErrorHandler(400, 'Please enter a username with min. 3 chars'));
        }
        // check for valid username
        if(await userExists(username)) {
            next(new ErrorHandler(409, 'Username already exists.'));
        }
        
        // password min 6 chars
        if (!password || password.length < 8) {
            next(new ErrorHandler(400, 'Please enter a password with min. 6 chars'));
        }

        // check valid email 
        if (!validateEmail(email)) {
            next(new ErrorHandler(400, 'Invalid email address'));
        }

        saveUser(username, email, password)
        .then((user) => {
            return res.status(201).json({
                token: generateAccessToken(user.user_id)
            });
        })
    }

    static postLogin = async(req, res, next) => {
        const { username, password } = req.body;
        const user = (await getUserByUsername(username)) || '';

        await bcrypt.compare(password, user.hash, async(err, same) => {
            if(same) {
                return res.status(201).json({
                    token: generateAccessToken(user.user_id)
                });
            } else {
                next(new ErrorHandler(401, 'Username or password incorrect'));
            }
        })
    }

    static postFavourites = async(req, res, next) => {
        const { referenceId, type } = req.body;
        return res.status(201).json({
            favourite: await addUserFavourite(req.userId, referenceId, type)
        });
    }

    static deleteFavourite = async(req, res, next) => {
        const { favouriteId } = req.body;
        await deleteUserFavourite(req.userId, favouriteId);
        return res.status(200).json({
            message: 'Favourite deleted.'
        });
    }

    static getRefreshToken = async(req, res, next) => {
        return res.status(201).send({
            token: generateAccessToken(req.userId)
        });
    }

    static getFavourites = async(req, res, next) => {
        return res.status(201).json({
            favourites: await getUserFavourites(req.userId)
        });
    }

    static getUserDetails = async(req, res, next) => {
        return res.status(201).json({
            user: await getUserById(req.userId)
        });
    }

    /** 
     * Middleware used to authenticate JWT token before allowing access to certain user
     * private data
     */
    static authenticateToken = (req, res, next) => {
        // Gather the jwt access token from the request header
        const authHeader = req.headers['authorization']
        const token = authHeader && authHeader.split(' ')[1]
        if (token == null) return res.sendStatus(401) // if there isn't any token

        jwt.verify(token, process.env.TOKEN_SECRET as string, (err: any, data: any) => {
            if (err) return res.sendStatus(403)
            req.userId = data.userId
            next() // pass the execution off to whatever request the client intended
        })
    }
}

/**
 * Saves user into the database
 * 
 * @param username - user's username
 * @param email - user's email
 * @param password  - user's password
 */
const saveUser = async(username: string, email: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
        bcrypt.hash(password, 10, (err, hash) => {
            const sql = 'INSERT INTO users(username, email, register_date, hash) VALUES (%L, %L, %L, %L) RETURNING *'
            const query = format.withArray(sql, [username, email, new Date(Date.now()), hash]);
            DB.query(query)
            .then(result => resolve(result[0]))
        })
    })
}

/**
 * Checks if username already exists
 * @param username - username to check
 */
const userExists = async (username: string) => {
    const sql = 'SELECT username FROM users WHERE LOWER(username) = LOWER(%L)'
    const query = format.withArray(sql, [username]);
    return (await DB.query(query)).length;
}

/**
 * Gets user by their ID
 */
const getUserById = async(userId: number) => {
    const sql = 'SELECT user_id, username, email, register_date FROM users WHERE user_id = %L'
    const query = format.withArray(sql, [userId]);
    return (await DB.query(query))[0];
}

/**
 * Gets user data by their username
 * @param username 
 */
const getUserByUsername = async(username: string) => {
    const sql = 'SELECT * FROM users WHERE username = %L'
    const query = format.withArray(sql, [username]);
    return (await DB.query(query))[0];
}

/**
 * Gets a user's favourites
 * @param userId G
 */
const getUserFavourites = async(userId: number) => {
    const sql = `SELECT * FROM user_favourites WHERE user_id = %L`
    const query = format.withArray(sql, [userId]);
    return (await DB.query(query));
}

/**
 * Adds a user favourite based on the user id, the refenrece id (i.e. stop_id, route_id)
 * 
 * @param userId - user id
 * @param referenceId - reference id of reference to become a favourite
 * @param type - the type of the reference 
 */
const addUserFavourite = async(userId: number, referenceId: string, type: string) => {
    const sql = 'INSERT INTO user_favourites(user_id, reference_id, type, datetime) VALUES (%L, %L, %L, %L) RETURNING *'
    const query = format.withArray(sql, [userId, referenceId, type, new Date(Date.now())]);
    return await DB.query(query);
}

/**
 * Removes user favourite from database.
 * Checks against user id to ensure deletion of only their own favourite
 * @param userId - user id of user
 * @param favouriteId - favourite id
 */
const deleteUserFavourite = async(userId: number, favouriteId: string) => {
    const sql = 'DELETE FROM user_favourites WHERE user_id = %L AND favourite_id = %L';
    const query = format.withArray(sql, [userId, favouriteId]);
    await DB.query(query);
}

/**
 * Validates email based on large RegEx
 * @param email 
 */
const validateEmail = (email: string) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Generates JWT based on user access token.
 * 
 * @param userId  - user id
 * @param expires - custom expiry time. Expiry in 1d by default
 */
const generateAccessToken = (userId: string, expires = '1d') => {
    return jwt.sign({ userId: userId }, process.env.TOKEN_SECRET, { expiresIn: expires });
}


authRoutes.post('/signup', AuthController.postSignup);
authRoutes.post('/login', AuthController.postLogin);

authRoutes.get('/refresh', AuthController.authenticateToken, AuthController.getRefreshToken);
authRoutes.get('/details', AuthController.authenticateToken, AuthController.getUserDetails);

authRoutes.get('/favourites', AuthController.authenticateToken, AuthController.getFavourites);
authRoutes.post('/favourites', AuthController.authenticateToken, AuthController.postFavourites);
authRoutes.delete('/favourites', AuthController.authenticateToken, AuthController.deleteFavourite);


