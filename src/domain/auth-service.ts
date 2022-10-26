import bcrypt from "bcrypt";
import {usersRepository} from "../repositories/users-repository";
import {v4 as uuidv4} from 'uuid';
import add from "date-fns/add";
import {emailsManager} from "../managers/email-manager";
import {UserAccountType} from "../types/user-account-type";
import {_generateHash} from "../helperFunctions";
import {emailConfirmationRepository} from "../repositories/emailConfirmation-repository";

export const authService = {
    async createUser(login: string, password: string, email: string) {

        const passwordSalt = await bcrypt.genSalt(10)
        const passwordHash = await _generateHash(password, passwordSalt)
        const userAccountId = uuidv4()

        const userAccount: UserAccountType = {
            accountData: {
                id: userAccountId,
                login,
                email,
                passwordSalt,
                passwordHash,
                createdAt: new Date().toISOString()
            },
            emailConfirmation: {
                id: userAccountId,
                confirmationCode: uuidv4(),
                expirationDate: add(new Date(), {
                    hours: 24,
                    // minutes: 1,
                    // seconds: 1
                }),
                isConfirmed: false
            }
        }

        console.log('confirmationCode:', userAccount.emailConfirmation.confirmationCode)

        const createdAccount = await this.createUserAccount(userAccount)

        if (!createdAccount) {
            return null
        }

        const info = await emailsManager.sendConfirmationEmail(userAccount)
        return {userAccount: createdAccount, info}
    },

    async confirmEmail(code: string): Promise<boolean> {
        const emailConfirmation = await this.giveEmailConfirmationByCodeOrId(code)

        if (!emailConfirmation) {
            console.log('emailConfirmation: ', false)
            return false
        }
        console.log('emailConfirmation: ', true)
        return await emailConfirmationRepository.updateConfirmation(code)
    },

    async resendConfirmRegistration(email: string) {
        const user = await usersRepository.giveUserByLoginOrEmail(email)

        if (!user) {
            return null
        }

        const emailConfirmation = await this.giveEmailConfirmationByCodeOrId(user.id)

        const userAccount = {accountData: user!, emailConfirmation: emailConfirmation!}
        return await emailsManager.sendConfirmationEmail(userAccount)
    },

    async createUserAccount(userAccount: UserAccountType) {
        const user = await usersRepository.createNewUser(userAccount.accountData)
        const emailConfirmation = await emailConfirmationRepository.createEmailConfirmation(userAccount.emailConfirmation)

        if (!user || !emailConfirmation) {
            return null
        }

        return {accountData: user, emailConfirmation: emailConfirmation}
    },

    async giveEmailConfirmationByCodeOrId(codeOrId: string) {
        const emailConfirmation = await emailConfirmationRepository.giveEmailConfirmationByCodeOrId(codeOrId)

        if (!emailConfirmation) {
            return null
        }

        if (emailConfirmation.expirationDate < new Date()) {
            return null
        }

        if (emailConfirmation.isConfirmed) {
            return null
        }

        return emailConfirmation
    }
}